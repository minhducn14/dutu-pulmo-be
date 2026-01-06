import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { Doctor } from './entities/doctor.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import {
  CreateDoctorScheduleDto,
  UpdateDoctorScheduleDto,
} from './dto/doctor-schedule.dto';
import {
  CreateFlexibleScheduleDto,
  UpdateFlexibleScheduleDto,
} from './dto/flexible-schedule.dto';
import { CreateTimeOffDto, UpdateTimeOffDto } from './dto/time-off.dto';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from 'src/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import {
  SCHEDULE_TYPE_PRIORITY,
  ScheduleType,
} from 'src/modules/common/enums/schedule-type.enum';

@Injectable()
export class DoctorScheduleService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly dataSource: DataSource,
  ) {}

  async findByDoctorId(
    doctorId: string,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const schedules = await this.scheduleRepository.find({
      where: { doctorId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', schedules);
  }

  async findByDoctorIdAndType(
    doctorId: string,
    scheduleType: ScheduleType,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const schedules = await this.scheduleRepository.find({
      where: { doctorId, scheduleType },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', schedules);
  }

  async findById(id: string): Promise<ResponseCommon<DoctorSchedule>> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
    });
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch với ID ${id}`);
    }
    return new ResponseCommon(200, 'SUCCESS', schedule);
  }

  private validateTimeRange(
    dto: CreateDoctorScheduleDto | UpdateDoctorScheduleDto,
  ): void {
    if (dto.slotDuration !== undefined) {
      if (dto.slotDuration <= 0) {
        throw new BadRequestException('Thời lượng slot phải lớn hơn 0 phút');
      }
      if (dto.slotDuration < 5) {
        throw new BadRequestException('Thời lượng slot tối thiểu 5 phút');
      }
      if (dto.slotDuration > 480) {
        throw new BadRequestException(
          'Thời lượng slot tối đa 480 phút (8 giờ)',
        );
      }
    }

    if (dto.startTime && dto.endTime) {
      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
      }

      // Validate working duration can fit at least 1 slot
      if (dto.slotDuration) {
        const [startH, startM] = dto.startTime.split(':').map(Number);
        const [endH, endM] = dto.endTime.split(':').map(Number);
        const workingMinutes = endH * 60 + endM - (startH * 60 + startM);

        if (workingMinutes < dto.slotDuration) {
          throw new BadRequestException(
            `Khoảng thời gian làm việc (${workingMinutes} phút) không đủ cho 1 slot (${dto.slotDuration} phút)`,
          );
        }
      }
    }

    // Validate effective date range
    if (dto.effectiveFrom && dto.effectiveUntil) {
      const from = new Date(dto.effectiveFrom);
      const until = new Date(dto.effectiveUntil);

      if (from >= until) {
        throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
      }
    }
  }

  private async checkOverlap(
    doctorId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    effectiveFrom: Date | null,
    effectiveUntil: Date | null,
    priority: number,
    excludeId?: string,
  ): Promise<void> {
    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('s')
      .where('s.doctorId = :doctorId', { doctorId })
      .andWhere('s.dayOfWeek = :dayOfWeek', { dayOfWeek })
      // Time overlap check: (StartA < EndB) and (EndA > StartB)
      .andWhere('s.startTime < :endTime', { endTime })
      .andWhere('s.endTime > :startTime', { startTime })
      .andWhere('s.priority >= :priority', { priority })
      // Effective Date overlap check
      .andWhere(
        effectiveUntil
          ? '(s.effectiveFrom <= :effectiveUntil OR s.effectiveFrom IS NULL)'
          : '1=1',
        { effectiveUntil },
      )
      // Condition 2: input.Start <= s.End
      // in.from <= s.until OR s.until IS NULL
      .andWhere(
        effectiveFrom
          ? '(s.effectiveUntil >= :effectiveFrom OR s.effectiveUntil IS NULL)'
          : '1=1',
        { effectiveFrom },
      );

    if (excludeId) {
      queryBuilder.andWhere('s.id != :excludeId', { excludeId });
    }

    const overlapping = await queryBuilder.getOne();

    if (overlapping) {
      const status = overlapping.isAvailable
        ? 'đang hoạt động'
        : 'không hoạt động';
      const effectiveStr = `(Hiệu lực: ${overlapping.effectiveFrom ? new Date(overlapping.effectiveFrom).toISOString().split('T')[0] : '...'} -> ${overlapping.effectiveUntil ? new Date(overlapping.effectiveUntil).toISOString().split('T')[0] : '...'})`;
      throw new ConflictException(
        `Lịch trùng với lịch ${status} ưu tiên cao hơn (priority: ${overlapping.priority}) ${effectiveStr} khung giờ (${overlapping.startTime} - ${overlapping.endTime}). ` +
          `Lịch hiện tại có priority ${priority}. Chỉ có thể tạo lịch với priority cao hơn hoặc bằng.`,
      );
    }
  }

  /**
   * Create a REGULAR schedule (fixed weekly schedule)
   * Lịch cố định - lặp lại theo tuần
   */
  async createRegular(
    doctorId: string,
    dto: CreateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const scheduleType = ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
      throw new BadRequestException(
        'Ngày trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ 7)',
      );
    }

    // Validate time ranges and slot duration
    this.validateTimeRange(dto);

    const isAvailable = dto.isAvailable ?? true;

    // Check for overlapping schedules
    const effectiveFromDate = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : null;
    const effectiveUntilDate = dto.effectiveUntil
      ? new Date(dto.effectiveUntil)
      : null;

    await this.checkOverlap(
      doctorId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
      effectiveFromDate,
      effectiveUntilDate,
      priority,
    );

    // Validate IN_CLINIC requires doctor.primaryHospitalId
    if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      const doctor = await this.doctorRepository.findOne({
        where: { id: doctorId },
        select: ['id', 'primaryHospitalId'],
      });
      if (!doctor?.primaryHospitalId) {
        throw new BadRequestException(
          'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
        );
      }
    }

    const schedule = this.scheduleRepository.create({
      ...dto,
      doctorId,
      priority,
      scheduleType,
      isAvailable,
      consultationFee: dto.consultationFee?.toString() ?? null,
      effectiveFrom: effectiveFromDate,
      effectiveUntil: effectiveUntilDate,
    });

    const saved = await this.scheduleRepository.save(schedule);

    let message = 'Tạo lịch làm việc cố định thành công';
    if (!effectiveUntilDate) {
      message += ' (lịch vô thời hạn)';
    }

    return new ResponseCommon(201, message, saved);
  }

  /**
   * Bulk create multiple REGULAR schedules in one request.
   * REGULAR schedules are fixed weekly schedules that repeat every week.
   * Wrapped in transaction for atomicity - all succeed or all fail.
   */
  async createManyRegular(
    doctorId: string,
    dtos: CreateDoctorScheduleDto[],
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    if (dtos.length === 0) {
      throw new BadRequestException('Danh sách lịch làm việc không được rỗng');
    }

    const scheduleType = ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    const dtosWithPriority = dtos.map((dto) => ({
      ...dto,
      scheduleType,
      priority,
      isAvailable: dto.isAvailable ?? true,
    }));

    // Validate all schedules first
    for (const dto of dtosWithPriority) {
      if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
        throw new BadRequestException(
          `Ngày trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ 7). Nhận được: ${dto.dayOfWeek}`,
        );
      }

      // Validate time ranges and slot duration
      this.validateTimeRange(dto);
    }

    // Check overlaps with existing schedules AND between new schedules
    for (const dto of dtosWithPriority) {
      const effectiveFromDate = dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : null;
      const effectiveUntilDate = dto.effectiveUntil
        ? new Date(dto.effectiveUntil)
        : null;

      await this.checkOverlap(
        doctorId,
        dto.dayOfWeek,
        dto.startTime,
        dto.endTime,
        effectiveFromDate,
        effectiveUntilDate,
        dto.priority,
      );
    }

    // Check for overlaps within the new schedules themselves
    for (let i = 0; i < dtosWithPriority.length; i++) {
      for (let j = i + 1; j < dtosWithPriority.length; j++) {
        if (dtosWithPriority[i].dayOfWeek === dtosWithPriority[j].dayOfWeek) {
          // Check time overlap
          const timeOverlap =
            dtosWithPriority[i].startTime < dtosWithPriority[j].endTime &&
            dtosWithPriority[i].endTime > dtosWithPriority[j].startTime;

          if (timeOverlap) {
            const iFrom = dtosWithPriority[i].effectiveFrom
              ? new Date(dtosWithPriority[i].effectiveFrom!)
              : null;
            const iUntil = dtosWithPriority[i].effectiveUntil
              ? new Date(dtosWithPriority[i].effectiveUntil!)
              : null;
            const jFrom = dtosWithPriority[j].effectiveFrom
              ? new Date(dtosWithPriority[j].effectiveFrom!)
              : null;
            const jUntil = dtosWithPriority[j].effectiveUntil
              ? new Date(dtosWithPriority[j].effectiveUntil!)
              : null;

            const dateOverlap =
              (iFrom === null || jUntil === null || iFrom <= jUntil) &&
              (jFrom === null || iUntil === null || jFrom <= iUntil);

            if (dateOverlap) {
              throw new ConflictException(
                `Lịch ${i + 1} trùng với lịch ${j + 1} trong cùng ngày ${dtosWithPriority[i].dayOfWeek} và khoảng thời gian hiệu lực`,
              );
            }
          }
        }
      }
    }

    // Create all schedules in transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const entities = dtosWithPriority.map((dto) =>
        manager.create(DoctorSchedule, {
          ...dto,
          doctorId,
          consultationFee: dto.consultationFee?.toString() ?? null,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          effectiveUntil: dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null,
        }),
      );

      return manager.save(DoctorSchedule, entities);
    });

    return new ResponseCommon(
      201,
      `Tạo ${result.length} lịch làm việc thành công`,
      result,
    );
  }

  /**
   * Update a REGULAR schedule.
   * Cannot change scheduleType - use specific methods for other schedule types.
   */
  async updateRegular(
    id: string,
    dto: UpdateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    // Ensure this is a REGULAR schedule
    if (existing.scheduleType !== ScheduleType.REGULAR) {
      throw new BadRequestException(
        `Lịch này không phải là lịch cố định (REGULAR). Sử dụng API phù hợp để cập nhật loại lịch ${existing.scheduleType}`,
      );
    }

    // Validate time ranges
    this.validateTimeRange(dto);

    // Check overlap if time or day changed
    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;

    // Priority stays the same for REGULAR schedules
    const priority = SCHEDULE_TYPE_PRIORITY[ScheduleType.REGULAR];

    const newIsAvailable = dto.isAvailable ?? existing.isAvailable;

    // Resolve effecitve dates: if in DTO use it (could be null), else use existing
    let newEffectiveFrom: Date | null = existing.effectiveFrom;
    if (dto.effectiveFrom !== undefined) {
      newEffectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    }

    let newEffectiveUntil: Date | null = existing.effectiveUntil;
    if (dto.effectiveUntil !== undefined) {
      newEffectiveUntil = dto.effectiveUntil
        ? new Date(dto.effectiveUntil)
        : null;
    }

    if (
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.effectiveFrom !== undefined ||
      dto.effectiveUntil !== undefined
    ) {
      await this.checkOverlap(
        existing.doctorId,
        newDayOfWeek,
        newStartTime,
        newEndTime,
        newEffectiveFrom,
        newEffectiveUntil,
        priority,
        id,
      );
    }

    // Validate IN_CLINIC requires doctor.primaryHospitalId
    const newAppointmentType = dto.appointmentType ?? existing.appointmentType;
    if (newAppointmentType === AppointmentTypeEnum.IN_CLINIC) {
      const doctor = await this.doctorRepository.findOne({
        where: { id: existing.doctorId },
        select: ['id', 'primaryHospitalId'],
      });
      if (!doctor?.primaryHospitalId) {
        throw new BadRequestException(
          'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
        );
      }
    }

    const updateData: Partial<DoctorSchedule> = {
      ...dto,
      scheduleType: undefined, // Cannot change scheduleType
      priority,
      isAvailable: newIsAvailable,
      consultationFee:
        dto.consultationFee !== undefined
          ? (dto.consultationFee?.toString() ?? null)
          : undefined,
      effectiveFrom:
        dto.effectiveFrom !== undefined
          ? dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : null
          : undefined,
      effectiveUntil:
        dto.effectiveUntil !== undefined
          ? dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null
          : undefined,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await this.scheduleRepository.update(id, updateData);
    const updated = await this.scheduleRepository.findOne({ where: { id } });
    return new ResponseCommon(
      200,
      'Cập nhật lịch làm việc cố định thành công',
      updated!,
    );
  }

  /**
   * Internal method to update any schedule type.
   * Used by updateFlexibleSchedule and updateTimeOff.
   */
  private async updateScheduleInternal(
    id: string,
    dto: UpdateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    // Validate time ranges
    this.validateTimeRange(dto);

    // Check overlap if time or day changed
    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;

    const priority = existing.priority;
    const newIsAvailable = dto.isAvailable ?? existing.isAvailable;

    // Resolve effective dates
    let newEffectiveFrom: Date | null = existing.effectiveFrom;
    if (dto.effectiveFrom !== undefined) {
      newEffectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    }

    let newEffectiveUntil: Date | null = existing.effectiveUntil;
    if (dto.effectiveUntil !== undefined) {
      newEffectiveUntil = dto.effectiveUntil
        ? new Date(dto.effectiveUntil)
        : null;
    }

    if (
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.effectiveFrom !== undefined ||
      dto.effectiveUntil !== undefined
    ) {
      await this.checkOverlap(
        existing.doctorId,
        newDayOfWeek,
        newStartTime,
        newEndTime,
        newEffectiveFrom,
        newEffectiveUntil,
        priority,
        id,
      );
    }

    const updateData: Partial<DoctorSchedule> = {
      ...dto,
      scheduleType: undefined,
      priority: undefined,
      isAvailable: newIsAvailable,
      consultationFee:
        dto.consultationFee !== undefined
          ? (dto.consultationFee?.toString() ?? null)
          : undefined,
      effectiveFrom:
        dto.effectiveFrom !== undefined
          ? dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : null
          : undefined,
      effectiveUntil:
        dto.effectiveUntil !== undefined
          ? dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null
          : undefined,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await this.scheduleRepository.update(id, updateData);
    const updated = await this.scheduleRepository.findOne({ where: { id } });
    return new ResponseCommon(
      200,
      'Cập nhật lịch thành công',
      updated!,
    );
  }


  async deleteRegular(id: string): Promise<ResponseCommon<null>> {
    const scheduleResult = await this.findById(id);
    const schedule = scheduleResult.data!;

    if (schedule.scheduleType !== ScheduleType.REGULAR) {
      throw new BadRequestException(
        `Lịch này không phải là lịch cố định (REGULAR). Sử dụng API phù hợp để xóa loại lịch ${schedule.scheduleType}`,
      );
    }

    await this.scheduleRepository.remove(schedule);
    return new ResponseCommon(200, 'Xóa lịch làm việc cố định thành công', null);
  }

  async findAvailableByDoctor(
    doctorId: string,
    dayOfWeek?: number,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Allow schedules that will become effective within the next 7 days
    const lookAheadDate = new Date();
    lookAheadDate.setDate(lookAheadDate.getDate() + 7);
    lookAheadDate.setHours(23, 59, 59, 999);

    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.doctorId = :doctorId', { doctorId })
      .andWhere('schedule.isAvailable = :isAvailable', { isAvailable: true })
      // Filter by effective dates - include schedules effective within next 7 days
      .andWhere(
        '(schedule.effectiveFrom IS NULL OR schedule.effectiveFrom <= :lookAheadDate)',
        { lookAheadDate },
      )
      .andWhere(
        '(schedule.effectiveUntil IS NULL OR schedule.effectiveUntil >= :today)',
        { today },
      );

    if (dayOfWeek !== undefined) {
      queryBuilder.andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek });
    }

    const schedules = await queryBuilder
      .orderBy('schedule.dayOfWeek', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .getMany();

    return new ResponseCommon(200, 'SUCCESS', schedules);
  }

  /**
   * Get effective consultation fee for a schedule
   * Fallback: schedule.consultationFee → doctor.defaultConsultationFee
   */
  async getEffectiveConsultationFee(
    schedule: DoctorSchedule,
  ): Promise<string | null> {
    // If schedule has its own fee, use it
    if (schedule.consultationFee) {
      return schedule.consultationFee;
    }

    // Otherwise, fallback to doctor's default
    const doctor = await this.doctorRepository.findOne({
      where: { id: schedule.doctorId },
      select: ['id', 'defaultConsultationFee'],
    });

    return doctor?.defaultConsultationFee ?? null;
  }

  /**
   * Enrich schedule with effectiveConsultationFee field
   */
  async enrichScheduleWithEffectiveFee(
    schedule: DoctorSchedule,
  ): Promise<DoctorSchedule & { effectiveConsultationFee: string | null }> {
    const effectiveConsultationFee =
      await this.getEffectiveConsultationFee(schedule);
    return {
      ...schedule,
      effectiveConsultationFee,
    };
  }

  /**
   * Enrich multiple schedules with effectiveConsultationFee
   */
  async enrichSchedulesWithEffectiveFee(
    schedules: DoctorSchedule[],
  ): Promise<(DoctorSchedule & { effectiveConsultationFee: string | null })[]> {
    if (schedules.length === 0) return [];

    // Get unique doctorIds
    const doctorIds = [...new Set(schedules.map((s) => s.doctorId))];

    // Batch fetch doctors
    const doctors = await this.doctorRepository
      .createQueryBuilder('doctor')
      .select(['doctor.id', 'doctor.defaultConsultationFee'])
      .whereInIds(doctorIds)
      .getMany();

    const doctorFeeMap = new Map(
      doctors.map((d) => [d.id, d.defaultConsultationFee]),
    );

    return schedules.map((schedule) => ({
      ...schedule,
      effectiveConsultationFee:
        schedule.consultationFee ?? doctorFeeMap.get(schedule.doctorId) ?? null,
    }));
  }

  // ========================================
  // FLEXIBLE SCHEDULE METHODS
  // ========================================

  /**
   * Create a flexible working schedule for a specific date
   * Lịch làm việc linh hoạt - chỉ áp dụng cho ngày đã chọn, không lặp lại
   */
  async createFlexibleSchedule(
    doctorId: string,
    dto: CreateFlexibleScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule & { cancelledAppointments: number }>> {
    const specificDate = new Date(dto.specificDate);
    const dayOfWeek = specificDate.getDay();
    const priority = SCHEDULE_TYPE_PRIORITY[ScheduleType.FLEXIBLE];

    // Validate time
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (specificDate < today) {
      throw new BadRequestException('Không thể tạo lịch cho ngày trong quá khứ');
    }

    // Validate doctor exists
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });
    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ với ID ${doctorId}`);
    }

    // Validate IN_CLINIC requires doctor.primaryHospitalId
    if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (!doctor.primaryHospitalId) {
        throw new BadRequestException(
          'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
        );
      }
    }

    // Check overlap with existing schedules for this specific date
    await this.checkOverlap(
      doctorId,
      dayOfWeek,
      dto.startTime,
      dto.endTime,
      specificDate,
      specificDate,
      priority,
    );

    // Cancel conflicting appointments
    const cancelledCount = await this.cancelConflictingAppointments(
      doctorId,
      specificDate,
      dto.startTime,
      dto.endTime,
    );

    // Create the schedule
    const schedule = this.scheduleRepository.create({
      doctorId,
      scheduleType: ScheduleType.FLEXIBLE,
      priority,
      dayOfWeek,
      specificDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      slotCapacity: dto.slotCapacity,
      slotDuration: dto.slotDuration,
      appointmentType: dto.appointmentType,
      minimumBookingTime: dto.minimumBookingDays
        ? dto.minimumBookingDays * 24 * 60
        : 60,
      maxAdvanceBookingDays: dto.maxAdvanceBookingDays ?? 30,
      consultationFee: dto.consultationFee?.toString() ?? null,
      discountPercent: dto.discountPercent ?? 0,
      isAvailable: dto.isAvailable ?? true,
      effectiveFrom: specificDate,
      effectiveUntil: specificDate,
    });

    const saved = await this.scheduleRepository.save(schedule);

    const message =
      cancelledCount > 0
        ? `Tạo lịch làm việc linh hoạt thành công. ${cancelledCount} lịch hẹn đã được hủy tự động.`
        : 'Tạo lịch làm việc linh hoạt thành công';

    return new ResponseCommon(201, message, {
      ...saved,
      cancelledAppointments: cancelledCount,
    });
  }

  /**
   * Update a flexible schedule
   */
  async updateFlexibleSchedule(
    id: string,
    dto: UpdateFlexibleScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    if (existing.scheduleType !== ScheduleType.FLEXIBLE) {
      throw new BadRequestException('Lịch này không phải là lịch linh hoạt');
    }

    // Use existing update logic
    const updateDto: UpdateDoctorScheduleDto = {
      startTime: dto.startTime,
      endTime: dto.endTime,
      slotCapacity: dto.slotCapacity,
      slotDuration: dto.slotDuration,
      appointmentType: dto.appointmentType,
      consultationFee: dto.consultationFee,
      isAvailable: dto.isAvailable,
    };

    return this.updateScheduleInternal(id, updateDto);
  }

  /**
   * Delete a flexible schedule
   * Xóa lịch làm việc linh hoạt
   */
  async deleteFlexibleSchedule(id: string): Promise<ResponseCommon<null>> {
    const existingResult = await this.findById(id);
    const schedule = existingResult.data!;

    if (schedule.scheduleType !== ScheduleType.FLEXIBLE) {
      throw new BadRequestException(
        `Lịch này không phải là lịch linh hoạt (FLEXIBLE). Sử dụng API phù hợp để xóa loại lịch ${schedule.scheduleType}`,
      );
    }

    await this.scheduleRepository.remove(schedule);
    return new ResponseCommon(200, 'Xóa lịch làm việc linh hoạt thành công', null);
  }

  async createTimeOff(
    doctorId: string,
    dto: CreateTimeOffDto,
  ): Promise<ResponseCommon<DoctorSchedule & { cancelledAppointments: number }>> {
    const specificDate = new Date(dto.specificDate);
    const dayOfWeek = specificDate.getDay();
    const priority = SCHEDULE_TYPE_PRIORITY[ScheduleType.TIME_OFF];

    // Validate time
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    // Validate date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (specificDate < today) {
      throw new BadRequestException('Không thể tạo lịch nghỉ cho ngày trong quá khứ');
    }

    // Validate doctor exists
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id'],
    });
    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ với ID ${doctorId}`);
    }

    // Check overlap with existing schedules
    await this.checkOverlap(
      doctorId,
      dayOfWeek,
      dto.startTime,
      dto.endTime,
      specificDate,
      specificDate,
      priority,
    );

    // Cancel conflicting appointments
    const cancelledCount = await this.cancelConflictingAppointments(
      doctorId,
      specificDate,
      dto.startTime,
      dto.endTime,
    );

    // Disable conflicting time slots
    await this.disableConflictingTimeSlots(
      doctorId,
      specificDate,
      dto.startTime,
      dto.endTime,
    );

    // Create the schedule
    const schedule = this.scheduleRepository.create({
      doctorId,
      scheduleType: ScheduleType.TIME_OFF,
      priority,
      dayOfWeek,
      specificDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      // TIME_OFF doesn't need slot settings, use defaults
      slotCapacity: 1,
      slotDuration: 30,
      appointmentType: AppointmentTypeEnum.VIDEO, // Doesn't matter for TIME_OFF
      isAvailable: false, // TIME_OFF is always unavailable
      note: dto.note ?? null,
      effectiveFrom: specificDate,
      effectiveUntil: specificDate,
    });

    const saved = await this.scheduleRepository.save(schedule);

    const message =
      cancelledCount > 0
        ? `Tạo lịch nghỉ thành công. ${cancelledCount} lịch hẹn đã được hủy tự động.`
        : 'Tạo lịch nghỉ thành công';

    return new ResponseCommon(201, message, {
      ...saved,
      cancelledAppointments: cancelledCount,
    });
  }

  /**
   * Update a time-off schedule
   */
  async updateTimeOff(
    id: string,
    dto: UpdateTimeOffDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    if (existing.scheduleType !== ScheduleType.TIME_OFF) {
      throw new BadRequestException('Lịch này không phải là lịch nghỉ');
    }

    const updateDto: UpdateDoctorScheduleDto = {
      startTime: dto.startTime,
      endTime: dto.endTime,
      note: dto.note,
      isAvailable: dto.isAvailable,
    };

    return this.updateScheduleInternal(id, updateDto);
  }

  /**
   * Delete a time-off schedule
   * Xóa lịch nghỉ
   */
  async deleteTimeOff(id: string): Promise<ResponseCommon<null>> {
    const existingResult = await this.findById(id);
    const schedule = existingResult.data!;

    if (schedule.scheduleType !== ScheduleType.TIME_OFF) {
      throw new BadRequestException(
        `Lịch này không phải là lịch nghỉ (TIME_OFF). Sử dụng API phù hợp để xóa loại lịch ${schedule.scheduleType}`,
      );
    }

    await this.scheduleRepository.remove(schedule);
    return new ResponseCommon(200, 'Xóa lịch nghỉ thành công', null);
  }

  private async cancelConflictingAppointments(
    doctorId: string,
    specificDate: Date,
    startTime: string,
    endTime: string,
  ): Promise<number> {
    const startOfDay = new Date(specificDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(specificDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Parse time strings
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    // Find appointments that overlap with the time range
    // Include both CONFIRMED and PENDING_PAYMENT statuses
    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startOfDay, endOfDay),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ]),
      },
    });

    // Filter to only those that overlap with the schedule time
    const conflicting = appointments.filter((apt) => {
      const aptEnd = new Date(
        apt.scheduledAt.getTime() + apt.durationMinutes * 60 * 1000,
      );
      return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
    });

    if (conflicting.length === 0) {
      return 0;
    }

    // Cancel each conflicting appointment
    await this.dataSource.transaction(async (manager) => {
      for (const apt of conflicting) {
        apt.status = AppointmentStatusEnum.CANCELLED;
        apt.cancelledAt = new Date();
        apt.cancellationReason = 'SCHEDULE_CHANGE';
        apt.cancelledBy = 'SYSTEM';

        await manager.save(apt);

        // Release the time slot if exists
        if (apt.timeSlotId) {
          await manager
            .createQueryBuilder()
            .update(TimeSlot)
            .set({
              bookedCount: () => 'GREATEST(booked_count - 1, 0)',
              isAvailable: true,
            })
            .where('id = :id', { id: apt.timeSlotId })
            .execute();
        }
      }
    });

    return conflicting.length;
  }

  private async disableConflictingTimeSlots(
    doctorId: string,
    specificDate: Date,
    startTime: string,
    endTime: string,
  ): Promise<number> {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    // Disable overlapping slots that have no bookings
    const result = await this.timeSlotRepository
      .createQueryBuilder()
      .update(TimeSlot)
      .set({ isAvailable: false })
      .where('doctorId = :doctorId', { doctorId })
      .andWhere('startTime >= :scheduleStart', { scheduleStart })
      .andWhere('endTime <= :scheduleEnd', { scheduleEnd })
      .andWhere('bookedCount = 0')
      .execute();

    return result.affected || 0;
  }
}
