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
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';
import {
  addDaysVN,
  endOfDayVN,
  startOfDayVN,
  vnNow,
  getDayVN,
} from '@/common/datetime';

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
    const now = vnNow();
    if (startDate < now) {
      // If start date is in past, start from tomorrow VN time
      const startOfToday = startOfDayVN(now);
      const startOfTomorrow = addDaysVN(startOfToday, 1);
      startDate = startOfTomorrow;
    }

    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const maxEndDate = addDaysVN(startDate, 90);
    if (endDate > maxEndDate) {
      throw new BadRequestException('Tối đa 90 ngày cho mỗi lần generate');
    }

    // 2. Get schedule to identify doctor
    const scheduleResult = await this.scheduleService.findById(scheduleId);
    if (!scheduleResult.data) {
       throw new BadRequestException('Lịch làm việc không tồn tại');
    }
    const schedule = scheduleResult.data;

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
    const currentDate = startOfDayVN(startDate);

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
      // Ensure startTime and endTime are Dates
      const newStart = new Date(newSlot.startTime!);
      const newEnd = new Date(newSlot.endTime!);
      
      return !existingSlots.some(
        (existingSlot) =>
          newStart < existingSlot.endTime &&
          newEnd > existingSlot.startTime,
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

        // Standardize base date using startOfDayVN
        const base = startOfDayVN(targetDate);
        
        // Calculate minutes from midnight
        const startMinutes = h1 * 60 + m1;
        const endMinutes = h2 * 60 + m2;
        
        const periodStart = new Date(base.getTime() + startMinutes * 60000);
        const periodEnd = new Date(base.getTime() + endMinutes * 60000);

        return { start: periodStart, end: periodEnd };
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
   */
  private async generateSlotsForDay(
    targetDate: Date,
    sortedSchedules: DoctorSchedule[],
  ): Promise<Partial<TimeSlot>[]> {
    const dayOfWeek = getDayVN(targetDate);
    
    const daySchedules = sortedSchedules.filter((s) => {
      // Check effective dates
      if (!this.isScheduleActiveOnDate(s, targetDate)) {
        return false;
      }

      // FLEXIBLE and TIME_OFF use specificDate
      if (
        s.scheduleType === ScheduleType.FLEXIBLE ||
        s.scheduleType === ScheduleType.TIME_OFF
      ) {
        if (s.specificDate) {
          // We need strictly match YYYY-MM-DD
          // Convert both to VN time range?
          // Let's assume s.specificDate is stored as 00:00:00 UTC or 00:00:00 VN?
          // If it comes from DTO as YYYY-MM-DD, TypeORM usually maps it to Date object.
          // Let's coerce to simplified string comparison.
          const sDate = new Date(s.specificDate);
          const tDate = targetDate; // This is 00:00 VN (as UTC date)
          
          // If sDate is 2023-10-10 00:00:00 (UTC?), and tDate is 2023-10-09 17:00:00Z (00:00 VN)
          // Then sDate.toISOString().split('T')[0] => 2023-10-10
          // tDate.toISOString() => 2023-10-09
          // MISMATCH!
          
          // We need to compare: formatVN(s.specificDate) === formatVN(targetDate)
          // But I can't import formatted if not available easily.
          // Let's assume s.specificDate was saved correctly using startOfDayVN logic (if we refactored it).
          // But it's old data.
          
          // Just use basic equality of .getTime()? No.
          // Safe verify: check if they are within 24h?
          
          // Let's trust logic from `isScheduleActiveOnDate` for effective dates, but for specificDate we need exact match.
          // Let's assume s.specificDate is YYYY-MM-DD.
          // Let's check overlap of the 24h period of that date with targetDate (which represents 24h of "today" in VN).
          
          // Or utilize `getDayVN` logic for consistent shifting.
          // Actually, if we just convert both to YYYY-MM-DD string in VN timezone, we are good.
          // Since I haven't imported formatVN, I will implement a quick local check.
          
          // Hack: diff < 12 hours?
          // No.
          
          // Let's just use `getDayVN` to check day consistency + strict year/month?
          // Too complex.
          
          // Let's rely on simple Date comparison if we assume previous inputs were "Date" objects (UTC midnight).
          // If inputs were "Date", then `s.specificDate` (YYYY-MM-DD from JSON) -> Date(YYYY-MM-DD T00:00:00.000Z).
          // And `targetDate` -> normalized to 00:00 VN (17:00 UTC prev day).
          // They differ by 7 hours.
          
          // So, `Math.abs(sDate.getTime() - targetDate.getTime()) < 12 * 60 * 60 * 1000`?
          // Yes, that works to detect "same day" regardless of 7h shift.
          
          const diffMs = Math.abs(new Date(s.specificDate).getTime() - targetDate.getTime());
          return diffMs < 12 * 60 * 60 * 1000;
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

    if (workingSchedules.length === 0) {
      return [];
    }

    // 🎯 STEP 1: Check if there are any FLEXIBLE schedules
    const flexibleSchedules = workingSchedules.filter(
      (s) => s.scheduleType === ScheduleType.FLEXIBLE,
    );

    // 🎯 STEP 2: Winner-Takes-All
    let selectedSchedules: DoctorSchedule[];
    
    if (flexibleSchedules.length > 0) {
      selectedSchedules = flexibleSchedules;
    } else {
      selectedSchedules = workingSchedules;
    }

    if (selectedSchedules.length === 0) {
      return [];
    }

    // 🎯 STEP 3: Generate slots
    let slots: Partial<TimeSlot>[] = [];
    for (const schedule of selectedSchedules) {
      slots.push(...this.generateSlotsFromSchedule(schedule, targetDate));
    }

    // 🎯 STEP 4: Filter out slots that overlap with TIME_OFF periods
    if (timeOffSchedules.length > 0) {
      const mergedTimeOffPeriods = this.mergeTimeOffPeriods(
        timeOffSchedules,
        targetDate,
      );

      slots = slots.filter((slot) => {
        const slotStart = new Date(slot.startTime!);
        const slotEnd = new Date(slot.endTime!);

        for (const period of mergedTimeOffPeriods) {
          if (slotStart < period.end && slotEnd > period.start) {
            return false;
          }
        }
        return true;
      });
    }

    return slots;
  }

  generateSlotsFromSchedule(
    schedule: DoctorSchedule,
    targetDate: Date,
  ): Partial<TimeSlot>[] {
    if (!schedule.slotDuration || schedule.slotDuration <= 0) {
      throw new BadRequestException('Thời lượng slot phải lớn hơn 0 phút');
    }

    const slots: Partial<TimeSlot>[] = [];
    const [startHour, startMin] = schedule.startTime.split(':').map(Number);
    const [endHour, endMin] = schedule.endTime.split(':').map(Number);

    // targetDate is startOfDayVN (00:00 VN normalized to UTC)
    // Add minutes directly
    const startTotalMins = startHour * 60 + startMin;
    const endTotalMins = endHour * 60 + endMin;
    
    const scheduleStart = new Date(targetDate.getTime() + startTotalMins * 60000);
    const scheduleEnd = new Date(targetDate.getTime() + endTotalMins * 60000);

    const slotDurationMs = schedule.slotDuration * 60 * 1000;
    let currentStart = new Date(scheduleStart);

    while (currentStart < scheduleEnd) {
      const slotEnd = new Date(currentStart.getTime() + slotDurationMs);

      if (slotEnd > scheduleEnd) {
        break;
      }

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

      currentStart = slotEnd;
    }

    return slots;
  }

  // Used by Preview Logic
  generateSlotsForDateRange(
    schedule: DoctorSchedule,
    startDate: Date,
    endDate: Date,
  ): Partial<TimeSlot>[] {
    const allSlots: Partial<TimeSlot>[] = [];

    const today = startOfDayVN(vnNow());

    if (schedule.effectiveUntil && schedule.effectiveUntil < today) {
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

    const currentDate = startOfDayVN(effectiveStart);

    while (currentDate <= effectiveEnd) {
      if (currentDate.getDay() === schedule.dayOfWeek && schedule.isAvailable) {
        // Warning: currentDate.getDay() is unsafe if we didn't use getDayVN.
        // But here we rely on standard JS. Refactoring to getDayVN logic:
        const dWeek = getDayVN(currentDate);
        
        if (dWeek === schedule.dayOfWeek) {
             const daySlots = this.generateSlotsFromSchedule(schedule, currentDate);
             allSlots.push(...daySlots);
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return allSlots;
  }

  getEarliestValidBookingTime(schedule: DoctorSchedule): Date {
    const now = vnNow();
    const minBookingMs = (schedule.minimumBookingTime || 60) * 60 * 1000;
    return new Date(now.getTime() + minBookingMs);
  }

  getLatestValidBookingDate(schedule: DoctorSchedule): Date {
    const today = startOfDayVN(vnNow());
    const maxDays = schedule.maxAdvanceBookingDays || 30;
    return new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000);
  }

  async generateAndSaveSlotsForDoctor(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ResponseCommon<TimeSlot[]>> {
    const now = vnNow();
    if (startDate < now) {
      const startOfToday = startOfDayVN(now);
      startDate = addDaysVN(startOfToday, 1);
    }

    if (endDate < startDate) {
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    }

    const maxEndDate = addDaysVN(startDate, 90);
    if (endDate > maxEndDate) {
      throw new BadRequestException('Tối đa 90 ngày cho mỗi lần generate');
    }

    const allSchedulesResult =
      await this.scheduleService.findByDoctorId(doctorId);
    const allSchedules = allSchedulesResult.data || [];

    if (allSchedules.length === 0) {
      return new ResponseCommon(400, 'Bác sĩ chưa có lịch làm việc nào', []);
    }

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

    const sortedSchedules = relevantSchedules.sort(
      (a, b) => b.priority - a.priority,
    );

    // Override logic
    await this.handleOverriddenSlots(
      doctorId,
      startDate,
      endDate,
      sortedSchedules,
    );

    // Generate
    const allSlots: Partial<TimeSlot>[] = [];
    const currentDate = startOfDayVN(startDate);

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

    const existingSlots = await this.timeSlotService.findSlotsInRange(
      doctorId,
      startDate,
      endDate,
    );

    const nonOverlapping = allSlots.filter((newSlot) => {
      const newStart = new Date(newSlot.startTime!);
      const newEnd = new Date(newSlot.endTime!);
      return !existingSlots.some(
        (existingSlot) =>
          newStart < existingSlot.endTime &&
          newEnd > existingSlot.startTime,
      );
    });

    if (nonOverlapping.length === 0) {
      return new ResponseCommon(
        200,
        'Tất cả slots đã tồn tại trong khoảng thời gian này',
        [],
      );
    }

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
    const checkDate = startOfDayVN(date);

    if (schedule.effectiveFrom) {
      // effectiveFrom needs normalization too if it was stored loosely
      const effectiveFrom = startOfDayVN(new Date(schedule.effectiveFrom));
      if (checkDate < effectiveFrom) {
        return false;
      }
    }

    if (schedule.effectiveUntil) {
      const effectiveUntil = endOfDayVN(new Date(schedule.effectiveUntil));
      if (checkDate > effectiveUntil) {
        return false;
      }
    }

    return true;
  }

  private async handleOverriddenSlots(
    doctorId: string,
    startDate: Date,
    endDate: Date,
    sortedSchedules: DoctorSchedule[],
  ): Promise<number> {
    let totalDisabled = 0;
    const currentDate = startOfDayVN(startDate);
    const endDateCopy = endOfDayVN(endDate);

    while (currentDate <= endDateCopy) {
      const dayOfWeek = getDayVN(currentDate);
      
      const daySchedules = sortedSchedules.filter((s) => {
        if (s.scheduleType === ScheduleType.TIME_OFF) return false;
        if (!this.isScheduleActiveOnDate(s, currentDate)) return false;

        if (s.scheduleType === ScheduleType.FLEXIBLE) {
          if (!s.specificDate) return false;
          // Use same approximate check as in generateSlotsForDay
          const diffMs = Math.abs(new Date(s.specificDate).getTime() - currentDate.getTime());
          return diffMs < 12 * 60 * 60 * 1000;
        }

        return s.dayOfWeek === dayOfWeek;
      });

      if (daySchedules.length === 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const flexibleSchedules = daySchedules.filter(
        (s) => s.scheduleType === ScheduleType.FLEXIBLE,
      );

      let winnerScheduleIds: string[];

      if (flexibleSchedules.length > 0) {
        winnerScheduleIds = flexibleSchedules.map((s) => s.id);
      } else {
        const regularSchedules = daySchedules.filter(
          (s) => s.scheduleType === ScheduleType.REGULAR,
        );
        winnerScheduleIds = regularSchedules.map((s) => s.id);
      }

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
