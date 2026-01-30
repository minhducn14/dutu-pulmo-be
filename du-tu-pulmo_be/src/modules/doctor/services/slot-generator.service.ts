import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { DoctorScheduleService } from '@/modules/doctor/services/doctor-schedule.service';
import { TimeSlotService } from '@/modules/doctor/services/time-slot.service';
import { CreateTimeSlotDto } from '@/modules/doctor/dto/time-slot.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ScheduleType } from 'src/modules/common/enums/schedule-type.enum';

@Injectable()
export class SlotGeneratorService {
  constructor(
    @Inject(forwardRef(() => DoctorScheduleService))
    private readonly scheduleService: DoctorScheduleService,
    @Inject(forwardRef(() => TimeSlotService))
    private readonly timeSlotService: TimeSlotService,
  ) {}

  async generateAndSaveSlots(
    scheduleId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ResponseCommon<TimeSlot[]>> {
    const now = new Date();
    if (startDate < now) {
      const adjustedStart = new Date(now);
      adjustedStart.setHours(0, 0, 0, 0);
      adjustedStart.setDate(adjustedStart.getDate() + 1);
      startDate = adjustedStart;
    }

    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const maxEndDate = new Date(startDate);
    maxEndDate.setDate(maxEndDate.getDate() + 90);
    if (endDate > maxEndDate) {
      throw new BadRequestException('Tối đa 90 ngày cho mỗi lần generate');
    }

    // 2. Get schedule to identify doctor
    const scheduleResult = await this.scheduleService.findById(scheduleId);
    const schedule = scheduleResult.data!;

    // 3. Get ALL schedules for this doctor (for priority handling)
    const allSchedulesResult = await this.scheduleService.findByDoctorId(
      schedule.doctorId,
    );
    const allSchedules = allSchedulesResult.data || [];

    // Filter active schedules that overlap with date range
    const relevantSchedules = allSchedules.filter((s) => {
      if (s.effectiveUntil && s.effectiveUntil < startDate) return false;
      if (s.effectiveFrom && s.effectiveFrom > endDate) return false;
      return true;
    });

    // Sort by priority (highest first)
    const sortedSchedules = relevantSchedules.sort(
      (a, b) => b.priority - a.priority,
    );

    // 4. Handle slots from lower-priority schedules
    await this.handleOverriddenSlots(
      schedule.doctorId,
      startDate,
      endDate,
      sortedSchedules,
    );

    // 5. Generate slots day by day
    const allSlots: Partial<TimeSlot>[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const daySlots = await this.generateSlotsForDay(
        currentDate,
        sortedSchedules,
      );
      allSlots.push(...daySlots);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (allSlots.length === 0) {
      return new ResponseCommon(
        200,
        'Không có slot nào được tạo trong khoảng thời gian này (do nghỉ hoặc không có lịch)',
        [],
      );
    }

    // 6. Get existing slots to filter out overlaps
    const existingSlots = await this.timeSlotService.findSlotsInRange(
      schedule.doctorId,
      startDate,
      endDate,
    );

    // 7. Filter out overlapping slots
    const nonOverlapping = allSlots.filter((newSlot) => {
      return !existingSlots.some(
        (existingSlot) =>
          newSlot.startTime! < existingSlot.endTime &&
          newSlot.endTime! > existingSlot.startTime,
      );
    });

    if (nonOverlapping.length === 0) {
      return new ResponseCommon(
        200,
        'Tất cả slots đã tồn tại trong khoảng thời gian này',
        [],
      );
    }

    // 8. Convert to DTOs and bulk create
    const dtos: CreateTimeSlotDto[] = nonOverlapping.map((slot) => ({
      startTime: slot.startTime!.toISOString(),
      endTime: slot.endTime!.toISOString(),
      capacity: slot.capacity!,
      allowedAppointmentTypes: slot.allowedAppointmentTypes!,
      isAvailable: true,
      scheduleId: slot.scheduleId ?? undefined,
    }));

    const result = await this.timeSlotService.createMany(
      schedule.doctorId,
      dtos,
    );
    return new ResponseCommon(
      201,
      `Đã tạo ${result.data?.length ?? 0} time slots thành công`,
      result.data ?? [],
    );
  }

  private mergeTimeOffPeriods(
    schedules: DoctorSchedule[],
    targetDate: Date,
  ): Array<{ start: Date; end: Date }> {
    // 1. Parse all TIME_OFF to periods
    const periods = schedules
      .map((s) => {
        const [h1, m1] = s.startTime.split(':').map(Number);
        const [h2, m2] = s.endTime.split(':').map(Number);

        const start = new Date(targetDate);
        start.setHours(h1, m1, 0, 0);

        const end = new Date(targetDate);
        end.setHours(h2, m2, 0, 0);

        return { start, end };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // 2. Merge overlapping periods
    const merged: Array<{ start: Date; end: Date }> = [];

    for (const period of periods) {
      if (merged.length === 0) {
        merged.push(period);
      } else {
        const last = merged[merged.length - 1];

        // Check if current period overlaps with last merged period
        if (period.start <= last.end) {
          // Extend last period if needed
          last.end = new Date(
            Math.max(last.end.getTime(), period.end.getTime()),
          );
        } else {
          // No overlap, add as new period
          merged.push(period);
        }
      }
    }

    return merged;
  }

  /**
   * 🎯 Generate slots for a specific day following Winner-Takes-All principle
   *
   * SPEC: Winner-Takes-All Logic
   * - Step 1: Check if there are any FLEXIBLE schedules for this day
   * - Step 2:
   *   - If FLEXIBLE exists → Use ONLY FLEXIBLE (completely exclude REGULAR)
   *   - If NO FLEXIBLE → Use REGULAR
   * - Step 3: Generate slots from selected schedules
   * - Step 4: Filter out slots overlapping with TIME_OFF periods
   */
  private async generateSlotsForDay(
    targetDate: Date,
    sortedSchedules: DoctorSchedule[],
  ): Promise<Partial<TimeSlot>[]> {
    const dayOfWeek = targetDate.getDay();
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Get all schedules active on this date
    // For FLEXIBLE/TIME_OFF: match by specificDate
    // For REGULAR/others: match by dayOfWeek
    const daySchedules = sortedSchedules.filter((s) => {
      if (!this.isScheduleActiveOnDate(s, targetDate)) {
        return false;
      }

      // FLEXIBLE and TIME_OFF use specificDate
      if (
        s.scheduleType === ScheduleType.FLEXIBLE ||
        s.scheduleType === ScheduleType.TIME_OFF
      ) {
        if (s.specificDate) {
          const specificDateStr = new Date(s.specificDate)
            .toISOString()
            .split('T')[0];
          return specificDateStr === targetDateStr;
        }
        return false;
      }

      // REGULAR and other types use dayOfWeek
      return s.dayOfWeek === dayOfWeek;
    });

    if (daySchedules.length === 0) {
      return [];
    }

    // Separate TIME_OFF schedules (blocking periods) from working schedules
    const timeOffSchedules = daySchedules.filter(
      (s) => s.scheduleType === ScheduleType.TIME_OFF,
    );
    const workingSchedules = daySchedules.filter(
      (s) => s.scheduleType !== ScheduleType.TIME_OFF,
    );

    // If no working schedules, no slots
    if (workingSchedules.length === 0) {
      return [];
    }

    // 🎯 STEP 1: Check if there are any FLEXIBLE schedules
    const flexibleSchedules = workingSchedules.filter(
      (s) => s.scheduleType === ScheduleType.FLEXIBLE,
    );

    // 🎯 STEP 2: Winner-Takes-All - Choose schedules based on FLEXIBLE existence
    let selectedSchedules: DoctorSchedule[];

    if (flexibleSchedules.length > 0) {
      // CÓ FLEXIBLE → CHỈ lấy FLEXIBLE (loại bỏ HOÀN TOÀN REGULAR)
      selectedSchedules = flexibleSchedules;
    } else {
      // KHÔNG CÓ FLEXIBLE → Lấy tất cả working schedules (bao gồm REGULAR và các loại khác nếu có)
      selectedSchedules = workingSchedules;
    }

    if (selectedSchedules.length === 0) {
      return [];
    }

    // 🎯 STEP 3: Generate slots from selected schedules
    let slots: Partial<TimeSlot>[] = [];
    for (const schedule of selectedSchedules) {
      slots.push(...this.generateSlotsFromSchedule(schedule, targetDate));
    }

    // 🎯 STEP 4: Filter out slots that overlap with TIME_OFF periods
    if (timeOffSchedules.length > 0) {
      // ✅ MERGE TIME_OFF trước khi filter
      const mergedTimeOffPeriods = this.mergeTimeOffPeriods(
        timeOffSchedules,
        targetDate,
      );

      slots = slots.filter((slot) => {
        const slotStart = slot.startTime as Date;
        const slotEnd = slot.endTime as Date;

        // Check overlap với merged periods
        for (const period of mergedTimeOffPeriods) {
          if (slotStart < period.end && slotEnd > period.start) {
            return false; // Exclude this slot
          }
        }
        return true; // Keep this slot
      });
    }

    return slots;
  }

  generateSlotsFromSchedule(
    schedule: DoctorSchedule,
    targetDate: Date,
  ): Partial<TimeSlot>[] {
    // Validate slot duration to prevent infinite loop
    if (!schedule.slotDuration || schedule.slotDuration <= 0) {
      throw new BadRequestException('Thời lượng slot phải lớn hơn 0 phút');
    }

    const slots: Partial<TimeSlot>[] = [];

    // Parse schedule times (format: HH:mm)
    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);

    // Create start and end timestamps for the target date
    const scheduleStart = new Date(targetDate);
    scheduleStart.setHours(startHour, startMin, 0, 0);

    const scheduleEnd = new Date(targetDate);
    scheduleEnd.setHours(endHour, endMin, 0, 0);

    const slotDurationMs = schedule.slotDuration * 60 * 1000;
    let currentStart = new Date(scheduleStart);

    while (currentStart < scheduleEnd) {
      const slotEnd = new Date(currentStart.getTime() + slotDurationMs);

      // Skip if slot exceeds schedule end
      if (slotEnd > scheduleEnd) {
        break;
      }

      // Create slot
      slots.push({
        doctorId: schedule.doctorId,
        scheduleId: schedule.id,
        startTime: new Date(currentStart),
        endTime: new Date(slotEnd),
        capacity: schedule.slotCapacity,
        allowedAppointmentTypes: [schedule.appointmentType],
        isAvailable: true,
        bookedCount: 0,
      });

      // Move to next slot
      currentStart = slotEnd;
    }

    return slots;
  }

  generateSlotsForDateRange(
    schedule: DoctorSchedule,
    startDate: Date,
    endDate: Date,
  ): Partial<TimeSlot>[] {
    const allSlots: Partial<TimeSlot>[] = [];

    // Check effective dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (schedule.effectiveUntil && schedule.effectiveUntil < today) {
      // Schedule is expired
      return [];
    }

    const effectiveStart = schedule.effectiveFrom
      ? schedule.effectiveFrom > startDate
        ? schedule.effectiveFrom
        : startDate
      : startDate;

    const effectiveEnd = schedule.effectiveUntil
      ? schedule.effectiveUntil < endDate
        ? schedule.effectiveUntil
        : endDate
      : endDate;

    // Iterate through each day in range
    const currentDate = new Date(effectiveStart);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= effectiveEnd) {
      // Check if this day matches the schedule's day of week
      if (currentDate.getDay() === schedule.dayOfWeek && schedule.isAvailable) {
        const daySlots = this.generateSlotsFromSchedule(schedule, currentDate);
        allSlots.push(...daySlots);
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allSlots;
  }

  getEarliestValidBookingTime(schedule: DoctorSchedule): Date {
    const now = new Date();
    const minBookingMs = (schedule.minimumBookingTime || 60) * 60 * 1000;
    return new Date(now.getTime() + minBookingMs);
  }

  getLatestValidBookingDate(schedule: DoctorSchedule): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDays = schedule.maxAdvanceBookingDays || 30;
    return new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000);
  }

  async generateAndSaveSlotsForDoctor(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ResponseCommon<TimeSlot[]>> {
    const now = new Date();
    if (startDate < now) {
      const adjustedStart = new Date(now);
      adjustedStart.setHours(0, 0, 0, 0);
      adjustedStart.setDate(adjustedStart.getDate() + 1);
      startDate = adjustedStart;
    }

    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const maxEndDate = new Date(startDate);
    maxEndDate.setDate(maxEndDate.getDate() + 90);
    if (endDate > maxEndDate) {
      throw new BadRequestException('Tối đa 90 ngày cho mỗi lần generate');
    }

    // Get ALL schedules for this doctor
    const allSchedulesResult =
      await this.scheduleService.findByDoctorId(doctorId);
    const allSchedules = allSchedulesResult.data || [];

    if (allSchedules.length === 0) {
      return new ResponseCommon(400, 'Bác sĩ chưa có lịch làm việc nào', []);
    }

    // Filter active schedules that overlap with date range
    const relevantSchedules = allSchedules.filter((s) => {
      if (s.effectiveUntil && s.effectiveUntil < startDate) return false;
      if (s.effectiveFrom && s.effectiveFrom > endDate) return false;
      return true;
    });

    if (relevantSchedules.length === 0) {
      return new ResponseCommon(
        200,
        'Không có lịch làm việc nào trong khoảng thời gian này',
        [],
      );
    }

    // Sort by priority (highest first)
    const sortedSchedules = relevantSchedules.sort(
      (a, b) => b.priority - a.priority,
    );

    // Handle slots from lower-priority schedules
    await this.handleOverriddenSlots(
      doctorId,
      startDate,
      endDate,
      sortedSchedules,
    );

    // Generate slots day by day using the same logic as generateAndSaveSlots
    const allSlots: Partial<TimeSlot>[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const daySlots = await this.generateSlotsForDay(
        currentDate,
        sortedSchedules,
      );
      allSlots.push(...daySlots);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (allSlots.length === 0) {
      return new ResponseCommon(
        200,
        'Không có slot nào được tạo trong khoảng thời gian này (do nghỉ hoặc không có lịch)',
        [],
      );
    }

    // Get existing slots to filter out overlaps
    const existingSlots = await this.timeSlotService.findSlotsInRange(
      doctorId,
      startDate,
      endDate,
    );

    // Filter out overlapping slots
    const nonOverlapping = allSlots.filter((newSlot) => {
      return !existingSlots.some(
        (existingSlot) =>
          newSlot.startTime! < existingSlot.endTime &&
          newSlot.endTime! > existingSlot.startTime,
      );
    });

    if (nonOverlapping.length === 0) {
      return new ResponseCommon(
        200,
        'Tất cả slots đã tồn tại trong khoảng thời gian này',
        [],
      );
    }

    // Convert to DTOs and bulk create
    const dtos: CreateTimeSlotDto[] = nonOverlapping.map((slot) => ({
      startTime: slot.startTime!.toISOString(),
      endTime: slot.endTime!.toISOString(),
      capacity: slot.capacity!,
      allowedAppointmentTypes: slot.allowedAppointmentTypes!,
      isAvailable: true,
      scheduleId: slot.scheduleId ?? undefined,
    }));

    const result = await this.timeSlotService.createMany(doctorId, dtos);
    return new ResponseCommon(
      201,
      `Đã tạo ${result.data?.length ?? 0} time slots thành công`,
      result.data ?? [],
    );
  }

  private isScheduleActiveOnDate(
    schedule: DoctorSchedule,
    date: Date,
  ): boolean {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (schedule.effectiveFrom) {
      const effectiveFrom = new Date(schedule.effectiveFrom);
      effectiveFrom.setHours(0, 0, 0, 0);
      if (checkDate < effectiveFrom) {
        return false;
      }
    }

    if (schedule.effectiveUntil) {
      const effectiveUntil = new Date(schedule.effectiveUntil);
      effectiveUntil.setHours(23, 59, 59, 999);
      if (checkDate > effectiveUntil) {
        return false;
      }
    }

    return true;
  }

  /**
   * 🎯 Handle overridden slots following Winner-Takes-All principle
   *
   * When a higher-priority schedule exists, disable slots from lower-priority schedules
   *
   * SPEC: Winner-Takes-All Logic
   * - If FLEXIBLE exists for a day → Disable all REGULAR slots
   * - If only REGULAR exists → Keep REGULAR slots active
   * - TIME_OFF is handled separately (filters out time periods, doesn't override schedules)
   */
  private async handleOverriddenSlots(
    doctorId: string,
    startDate: Date,
    endDate: Date,
    sortedSchedules: DoctorSchedule[],
  ): Promise<number> {
    let totalDisabled = 0;
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const endDateCopy = new Date(endDate);
    endDateCopy.setHours(23, 59, 59, 999);

    while (currentDate <= endDateCopy) {
      const dayOfWeek = currentDate.getDay();
      const targetDateStr = currentDate.toISOString().split('T')[0];

      // Get schedules active on this day (EXCLUDE TIME_OFF)
      // TIME_OFF only blocks time periods, doesn't override other schedules
      const daySchedules = sortedSchedules.filter((s) => {
        if (s.scheduleType === ScheduleType.TIME_OFF) return false;
        if (!this.isScheduleActiveOnDate(s, currentDate)) return false;

        // FLEXIBLE: check specificDate
        if (s.scheduleType === ScheduleType.FLEXIBLE) {
          if (!s.specificDate) return false;
          const specificDateStr = new Date(s.specificDate)
            .toISOString()
            .split('T')[0];
          return specificDateStr === targetDateStr;
        }

        // REGULAR: check dayOfWeek
        return s.dayOfWeek === dayOfWeek;
      });

      if (daySchedules.length === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // 🎯 Winner-Takes-All logic
      const flexibleSchedules = daySchedules.filter(
        (s) => s.scheduleType === ScheduleType.FLEXIBLE,
      );

      let winnerScheduleIds: string[];

      if (flexibleSchedules.length > 0) {
        // CÓ FLEXIBLE → Chỉ giữ lại FLEXIBLE schedules
        winnerScheduleIds = flexibleSchedules.map((s) => s.id);
      } else {
        // KHÔNG CÓ FLEXIBLE → Giữ lại REGULAR schedules
        const regularSchedules = daySchedules.filter(
          (s) => s.scheduleType === ScheduleType.REGULAR,
        );
        winnerScheduleIds = regularSchedules.map((s) => s.id);
      }

      // Disable slots that don't belong to winner schedules
      const disabled = await this.timeSlotService.disableSlotsNotInSchedules(
        doctorId,
        currentDate,
        winnerScheduleIds,
      );

      totalDisabled += disabled;
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalDisabled;
  }
}
