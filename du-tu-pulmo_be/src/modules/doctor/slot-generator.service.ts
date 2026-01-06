import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { Doctor } from './entities/doctor.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { DoctorScheduleService } from './doctor-schedule.service';
import { TimeSlotService } from './time-slot.service';
import { CreateTimeSlotDto } from './dto/time-slot.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { ScheduleType, SCHEDULE_TYPE_PRIORITY } from 'src/modules/common/enums/schedule-type.enum';

@Injectable()
export class SlotGeneratorService {
  private doctorHospitalCache = new Map<string, string | null>();

  constructor(
    @Inject(forwardRef(() => DoctorScheduleService))
    private readonly scheduleService: DoctorScheduleService,
    @Inject(forwardRef(() => TimeSlotService))
    private readonly timeSlotService: TimeSlotService,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
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
    const allSchedulesResult = await this.scheduleService.findByDoctorId(schedule.doctorId);
    const allSchedules = allSchedulesResult.data || [];

    // Filter active schedules that overlap with date range
    const relevantSchedules = allSchedules.filter(s => {
      if (s.effectiveUntil && s.effectiveUntil < startDate) return false;
      if (s.effectiveFrom && s.effectiveFrom > endDate) return false;
      return true;
    });

    // Sort by priority (highest first)
    const sortedSchedules = relevantSchedules.sort((a, b) => b.priority - a.priority);

    // 4. Generate slots day by day
    const allSlots: Partial<TimeSlot>[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const daySlots = await this.generateSlotsForDay(currentDate, sortedSchedules);
      allSlots.push(...daySlots);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (allSlots.length === 0) {
      return new ResponseCommon(200, 'Không có slot nào được tạo trong khoảng thời gian này (do nghỉ hoặc không có lịch)', []);
    }

    // 5. Get existing slots to filter out overlaps
    const existingSlots = await this.timeSlotService.findAvailableSlots(
      schedule.doctorId,
      startDate,
      endDate,
    );

    // 6. Filter out overlapping slots
    const nonOverlapping = allSlots.filter(newSlot => {
      return !existingSlots.some(existingSlot =>
        newSlot.startTime! < existingSlot.endTime &&
        newSlot.endTime! > existingSlot.startTime
      );
    });

    if (nonOverlapping.length === 0) {
      return new ResponseCommon(200, 'Tất cả slots đã tồn tại trong khoảng thời gian này', []);
    }

    // 7. Convert to DTOs and bulk create
    const dtos: CreateTimeSlotDto[] = nonOverlapping.map(slot => ({
      startTime: slot.startTime!.toISOString(),
      endTime: slot.endTime!.toISOString(),
      capacity: slot.capacity!,
      allowedAppointmentTypes: slot.allowedAppointmentTypes!,
      locationHospitalId: slot.locationHospitalId ?? undefined,
      isAvailable: true,
    }));

    const result = await this.timeSlotService.createMany(schedule.doctorId, dtos);
    return new ResponseCommon(
      201, 
      `Đã tạo ${result.data?.length ?? 0} time slots thành công`,
      result.data ?? []
    );
  }

  /**
   * 🔥 FIXED: Chỉ xử lý schedules có priority cao nhất trong ngày
   */
  private async generateSlotsForDay(
    targetDate: Date,
    sortedSchedules: DoctorSchedule[],
  ): Promise<Partial<TimeSlot>[]> {
    const dayOfWeek = targetDate.getDay();
    
    // Get all schedules active on this date and day of week
    const daySchedules = sortedSchedules.filter(s =>
      s.dayOfWeek === dayOfWeek && this.isScheduleActiveOnDate(s, targetDate)
    );

    if (daySchedules.length === 0) {
      return [];
    }

    // 🎯 STEP 1: Tìm priority cao nhất có trong ngày này
    const maxPriority = Math.max(
      ...daySchedules.map(s => SCHEDULE_TYPE_PRIORITY[s.scheduleType])
    );

    // 🎯 STEP 2: Lấy TẤT CẢ schedules có priority cao nhất
    const highestPrioritySchedules = daySchedules.filter(s =>
      SCHEDULE_TYPE_PRIORITY[s.scheduleType] === maxPriority
    );

    // Get schedule type (tất cả schedules trong group này có cùng priority)
    const scheduleType = highestPrioritySchedules[0].scheduleType;

    // 🎯 STEP 3: Nếu là BLOCK_OUT → nghỉ hoàn toàn
    if (scheduleType === ScheduleType.BLOCK_OUT) {
      return [];
    }

    // 🎯 STEP 4: Generate slots từ TẤT CẢ schedules có priority cao nhất và isAvailable = true
    const availableSchedules = highestPrioritySchedules.filter(s => s.isAvailable);

    // Lấy hospitalId từ doctor (cache để tránh query nhiều lần)
    const doctorId = availableSchedules[0]?.doctorId;
    const hospitalId = doctorId ? await this.getDoctorHospitalId(doctorId) : null;

    const slots: Partial<TimeSlot>[] = [];
    for (const schedule of availableSchedules) {
      slots.push(...this.generateSlotsFromSchedule(schedule, targetDate, hospitalId));
    }

    return slots;
  }

  /**
   * Get doctor's primaryHospitalId with caching
   */
  private async getDoctorHospitalId(doctorId: string): Promise<string | null> {
    if (this.doctorHospitalCache.has(doctorId)) {
      return this.doctorHospitalCache.get(doctorId) ?? null;
    }
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });
    const hospitalId = doctor?.primaryHospitalId ?? null;
    this.doctorHospitalCache.set(doctorId, hospitalId);
    return hospitalId;
  }

  /**
   * Clear cache (call after generating slots for a batch)
   */
  clearDoctorHospitalCache(): void {
    this.doctorHospitalCache.clear();
  }

  generateSlotsFromSchedule(
    schedule: DoctorSchedule,
    targetDate: Date,
    hospitalId?: string | null,
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
      
      // Create slot - hospitalId từ doctor.primaryHospitalId
      slots.push({
        doctorId: schedule.doctorId,
        startTime: new Date(currentStart),
        endTime: new Date(slotEnd),
        capacity: schedule.slotCapacity,
        locationHospitalId: hospitalId ?? null,
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
      ? (schedule.effectiveFrom > startDate ? schedule.effectiveFrom : startDate)
      : startDate;
    
    const effectiveEnd = schedule.effectiveUntil
      ? (schedule.effectiveUntil < endDate ? schedule.effectiveUntil : endDate)
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
    const allSchedulesResult = await this.scheduleService.findByDoctorId(doctorId);
    const allSchedules = allSchedulesResult.data || [];

    if (allSchedules.length === 0) {
      return new ResponseCommon(400, 'Bác sĩ chưa có lịch làm việc nào', []);
    }

    // Filter active schedules that overlap with date range
    const relevantSchedules = allSchedules.filter(s => {
      if (s.effectiveUntil && s.effectiveUntil < startDate) return false;
      if (s.effectiveFrom && s.effectiveFrom > endDate) return false;
      return true;
    });

    if (relevantSchedules.length === 0) {
      return new ResponseCommon(200, 'Không có lịch làm việc nào trong khoảng thời gian này', []);
    }

    // Sort by priority (highest first)
    const sortedSchedules = relevantSchedules.sort((a, b) => b.priority - a.priority);

    // Generate slots day by day using the same logic as generateAndSaveSlots
    const allSlots: Partial<TimeSlot>[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const daySlots = await this.generateSlotsForDay(currentDate, sortedSchedules);
      allSlots.push(...daySlots);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (allSlots.length === 0) {
      return new ResponseCommon(200, 'Không có slot nào được tạo trong khoảng thời gian này (do nghỉ hoặc không có lịch)', []);
    }

    // Get existing slots to filter out overlaps
    const existingSlots = await this.timeSlotService.findAvailableSlots(
      doctorId,
      startDate,
      endDate,
    );

    // Filter out overlapping slots
    const nonOverlapping = allSlots.filter(newSlot => {
      return !existingSlots.some(existingSlot =>
        newSlot.startTime! < existingSlot.endTime &&
        newSlot.endTime! > existingSlot.startTime
      );
    });

    if (nonOverlapping.length === 0) {
      return new ResponseCommon(200, 'Tất cả slots đã tồn tại trong khoảng thời gian này', []);
    }

    // Convert to DTOs and bulk create
    const dtos: CreateTimeSlotDto[] = nonOverlapping.map(slot => ({
      startTime: slot.startTime!.toISOString(),
      endTime: slot.endTime!.toISOString(),
      capacity: slot.capacity!,
      allowedAppointmentTypes: slot.allowedAppointmentTypes!,
      locationHospitalId: slot.locationHospitalId ?? undefined,
      isAvailable: true,
    }));

    const result = await this.timeSlotService.createMany(doctorId, dtos);
    return new ResponseCommon(
      201,
      `Đã tạo ${result.data?.length ?? 0} time slots thành công`,
      result.data ?? []
    );
  }

  private isScheduleActiveOnDate(schedule: DoctorSchedule, date: Date): boolean {
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
      effectiveUntil.setHours(0, 0, 0, 0);
      if (checkDate > effectiveUntil) {
        return false;
      }
    }

    return true;
  }
}