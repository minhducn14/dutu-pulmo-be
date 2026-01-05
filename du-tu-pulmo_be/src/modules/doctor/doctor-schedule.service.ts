import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { Doctor } from './entities/doctor.entity';
import { CreateDoctorScheduleDto, UpdateDoctorScheduleDto, BulkHolidayScheduleDto } from './dto/doctor-schedule.dto';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { SCHEDULE_TYPE_PRIORITY, ScheduleType } from 'src/modules/common/enums/schedule-type.enum';

@Injectable()
export class DoctorScheduleService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    private readonly dataSource: DataSource,
  ) {}

  async findByDoctorId(doctorId: string): Promise<ResponseCommon<DoctorSchedule[]>> {
    const schedules = await this.scheduleRepository.find({
      where: { doctorId },
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

  private validateTimeRange(dto: CreateDoctorScheduleDto | UpdateDoctorScheduleDto): void {
    if (dto.slotDuration !== undefined) {
      if (dto.slotDuration <= 0) {
        throw new BadRequestException('Thời lượng slot phải lớn hơn 0 phút');
      }
      if (dto.slotDuration < 5) {
        throw new BadRequestException('Thời lượng slot tối thiểu 5 phút');
      }
      if (dto.slotDuration > 480) {
        throw new BadRequestException('Thời lượng slot tối đa 480 phút (8 giờ)');
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
        const workingMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        if (workingMinutes < dto.slotDuration) {
          throw new BadRequestException(
            `Khoảng thời gian làm việc (${workingMinutes} phút) không đủ cho 1 slot (${dto.slotDuration} phút)`
          );
        }
      }
    }

    // Validate effective date range
    if (dto.effectiveFrom && dto.effectiveUntil) {
      const from = new Date(dto.effectiveFrom);
      const until = new Date(dto.effectiveUntil);

      if (from >= until) {
        throw new BadRequestException(
          'Ngày bắt đầu phải trước ngày kết thúc'
        );
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
        { effectiveUntil }
      )
      // Condition 2: input.Start <= s.End
      // in.from <= s.until OR s.until IS NULL
      .andWhere(
         effectiveFrom
          ? '(s.effectiveUntil >= :effectiveFrom OR s.effectiveUntil IS NULL)'
          : '1=1',
        { effectiveFrom }
      );

    if (excludeId) {
      queryBuilder.andWhere('s.id != :excludeId', { excludeId });
    }

    const overlapping = await queryBuilder.getOne();
    
    if (overlapping) {
      const status = overlapping.isAvailable ? 'đang hoạt động' : 'không hoạt động';
      const effectiveStr = `(Hiệu lực: ${overlapping.effectiveFrom ? new Date(overlapping.effectiveFrom).toISOString().split('T')[0] : '...'} -> ${overlapping.effectiveUntil ? new Date(overlapping.effectiveUntil).toISOString().split('T')[0] : '...'})`;
      throw new ConflictException(
        `Lịch trùng với lịch ${status} ưu tiên cao hơn (priority: ${overlapping.priority}) ${effectiveStr} khung giờ (${overlapping.startTime} - ${overlapping.endTime}). ` +
        `Lịch hiện tại có priority ${priority}. Chỉ có thể tạo lịch với priority cao hơn hoặc bằng.`
      );
    }
  }

  async create(doctorId: string, dto: CreateDoctorScheduleDto): Promise<ResponseCommon<DoctorSchedule>> {
    const scheduleType = dto.scheduleType || ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
      throw new BadRequestException('Ngày trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ 7)');
    }

    // Validate time ranges and slot duration (SKIP for BLOCK_OUT)
    if (scheduleType !== ScheduleType.BLOCK_OUT) {
      this.validateTimeRange(dto);
    }

    // BLOCK_OUT must have isAvailable=false
    let isAvailable = dto.isAvailable ?? true;
    if (scheduleType === ScheduleType.BLOCK_OUT) {
      isAvailable = false;
      // For block-out, defaults if not provided
      if (!dto.startTime) dto.startTime = '00:00';
      if (!dto.endTime) dto.endTime = '23:59';
    }

    // Check for overlapping schedules
    const effectiveFromDate = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    const effectiveUntilDate = dto.effectiveUntil ? new Date(dto.effectiveUntil) : null;
    
    await this.checkOverlap(
      doctorId, 
      dto.dayOfWeek, 
      dto.startTime, 
      dto.endTime, 
      effectiveFromDate,
      effectiveUntilDate,
      priority
    );

    // Validate IN_CLINIC requires hospitalId (SKIP for BLOCK_OUT)
    if (scheduleType !== ScheduleType.BLOCK_OUT) {
      if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC && !dto.hospitalId) {
        throw new BadRequestException('Khám tại phòng khám yêu cầu chọn bệnh viện/phòng khám');
      }
    }

    const schedule = this.scheduleRepository.create({
      ...dto,
      doctorId,
      priority,
      scheduleType,
      isAvailable,
      consultationFee: dto.consultationFee?.toString() ?? null,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
      effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
    });

    const saved = await this.scheduleRepository.save(schedule);
    
    let message = 'Tạo lịch làm việc thành công';
    if (scheduleType === ScheduleType.BLOCK_OUT) {
      message = `Tạo lịch nghỉ thành công (${dto.note || 'không có ghi chú'})`;
    } else if (scheduleType === ScheduleType.HOLIDAY) {
      message = `Tạo lịch ngày lễ thành công (${dto.note || 'không có ghi chú'})`;
    } else if (!effectiveUntilDate) {
      message += ' (lịch vô thời hạn)';
    }

    return new ResponseCommon(201, message, saved);
  }

  /**
   * Bulk create multiple schedules in one request.
   * Wrapped in transaction for atomicity - all succeed or all fail.
   */
  async createMany(doctorId: string, dtos: CreateDoctorScheduleDto[]): Promise<ResponseCommon<DoctorSchedule[]>> {
    if (dtos.length === 0) {
      throw new BadRequestException('Danh sách lịch làm việc không được rỗng');
    }

    const dtosWithPriority = dtos.map(dto => {
      const scheduleType = dto.scheduleType || ScheduleType.REGULAR;
      return {
        ...dto,
        scheduleType,
        priority: SCHEDULE_TYPE_PRIORITY[scheduleType],
        isAvailable: scheduleType === ScheduleType.BLOCK_OUT ? false : (dto.isAvailable ?? true),
      };
    });

    // Validate all schedules first
    for (const dto of dtosWithPriority) {
      if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
        throw new BadRequestException(`Ngày trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ 7). Nhận được: ${dto.dayOfWeek}`);
      }

      // Validate time ranges and slot duration (skip for BLOCK_OUT)
      if (dto.scheduleType !== ScheduleType.BLOCK_OUT) {
        this.validateTimeRange(dto);

        if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC && !dto.hospitalId) {
          throw new BadRequestException(`Lịch ${dto.dayOfWeek} (${dto.startTime}-${dto.endTime}): Khám tại phòng khám yêu cầu chọn bệnh viện`);
        }
      }
    }

    // Check overlaps with existing schedules AND between new schedules
    for (const dto of dtosWithPriority) {
      const effectiveFromDate = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
      const effectiveUntilDate = dto.effectiveUntil ? new Date(dto.effectiveUntil) : null;

      await this.checkOverlap(
        doctorId, 
        dto.dayOfWeek, 
        dto.startTime, 
        dto.endTime,
        effectiveFromDate,
        effectiveUntilDate,
        dto.priority
      );
    }

    // Check for overlaps within the new schedules themselves
    for (let i = 0; i < dtosWithPriority.length; i++) {
      for (let j = i + 1; j < dtosWithPriority.length; j++) {
        if (dtosWithPriority[i].dayOfWeek === dtosWithPriority[j].dayOfWeek) {
          // Check time overlap
          const timeOverlap = dtosWithPriority[i].startTime < dtosWithPriority[j].endTime && dtosWithPriority[i].endTime > dtosWithPriority[j].startTime;
          
          if (timeOverlap) {
            // Only check overlap if SAME priority
            if (dtosWithPriority[i].priority === dtosWithPriority[j].priority) {
              const iFrom = dtosWithPriority[i].effectiveFrom ? new Date(dtosWithPriority[i].effectiveFrom!) : null;
              const iUntil = dtosWithPriority[i].effectiveUntil ? new Date(dtosWithPriority[i].effectiveUntil!) : null;
              const jFrom = dtosWithPriority[j].effectiveFrom ? new Date(dtosWithPriority[j].effectiveFrom!) : null;
              const jUntil = dtosWithPriority[j].effectiveUntil ? new Date(dtosWithPriority[j].effectiveUntil!) : null;

              const dateOverlap = 
                (iFrom === null || jUntil === null || iFrom <= jUntil) &&
                (jFrom === null || iUntil === null || jFrom <= iUntil);

              if (dateOverlap) {
                throw new ConflictException(
                  `Lịch ${i + 1} trùng với lịch ${j + 1} trong cùng ngày ${dtosWithPriority[i].dayOfWeek} và khoảng thời gian hiệu lực (cùng priority)`
                );
              }
            }
          }
        }
      }
    }

    // Create all schedules in transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const entities = dtosWithPriority.map(dto => manager.create(DoctorSchedule, {
        ...dto,
        doctorId,
        consultationFee: dto.consultationFee?.toString() ?? null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
      }));

      return manager.save(DoctorSchedule, entities);
    });

    return new ResponseCommon(201, `Tạo ${result.length} lịch làm việc thành công`, result);
  }

  async createBulkHoliday(
    doctorId: string, 
    dto: BulkHolidayScheduleDto
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    // Validate date range
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    
    if (startDate >= endDate) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }

    if (dto.daysOfWeek.length === 0) {
      throw new BadRequestException('Phải chọn ít nhất 1 ngày trong tuần');
    }

    const isBlockOut = dto.scheduleType === ScheduleType.BLOCK_OUT;
    const isHoliday = dto.scheduleType === ScheduleType.HOLIDAY;
    const isBlockingSchedule = isBlockOut || isHoliday;
    
    const startTime = isBlockOut ? '00:00' : (dto.startTime || '09:00');
    const endTime = isBlockOut ? '23:59' : (dto.endTime || '17:00');

    // For BLOCK_OUT/HOLIDAY, use ONLINE to avoid hospital_id requirement
    const appointmentType = isBlockingSchedule 
      ? AppointmentTypeEnum.VIDEO 
      : (dto.appointmentType || AppointmentTypeEnum.IN_CLINIC);

    const scheduleDtos: CreateDoctorScheduleDto[] = dto.daysOfWeek.map(dayOfWeek => ({
      dayOfWeek,
      startTime,
      endTime,
      slotDuration: dto.slotDuration || 30,
      slotCapacity: dto.slotCapacity || 1,
      appointmentType,
      hospitalId: isBlockingSchedule ? undefined : dto.hospitalId,
      effectiveFrom: dto.startDate,
      effectiveUntil: dto.endDate,
      scheduleType: dto.scheduleType,
      note: dto.note,
      consultationFee: dto.consultationFee,
      isAvailable: !isBlockingSchedule,
    }));

    return this.createMany(doctorId, scheduleDtos);
  }

  async update(id: string, dto: UpdateDoctorScheduleDto): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    // Validate time ranges
    this.validateTimeRange(dto);

    // Check overlap if time or day changed
    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    
    // Recalculate priority if scheduleType changed
    let newPriority = existing.priority;
    if (dto.scheduleType !== undefined) {
      newPriority = SCHEDULE_TYPE_PRIORITY[dto.scheduleType];
    }

    // Force isAvailable=false if changing to BLOCK_OUT
    let newIsAvailable = dto.isAvailable ?? existing.isAvailable;
    const newScheduleType = dto.scheduleType ?? existing.scheduleType;
    if (newScheduleType === ScheduleType.BLOCK_OUT) {
      newIsAvailable = false;
    }

    // Resolve effecitve dates: if in DTO use it (could be null), else use existing
    let newEffectiveFrom: Date | null = existing.effectiveFrom;
    if (dto.effectiveFrom !== undefined) {
      newEffectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    }

    let newEffectiveUntil: Date | null = existing.effectiveUntil;
    if (dto.effectiveUntil !== undefined) {
      newEffectiveUntil = dto.effectiveUntil ? new Date(dto.effectiveUntil) : null;
    }

    if (
      dto.dayOfWeek !== undefined || 
      dto.startTime !== undefined || 
      dto.endTime !== undefined ||
      dto.effectiveFrom !== undefined ||
      dto.effectiveUntil !== undefined ||
      dto.scheduleType !== undefined
    ) {
      await this.checkOverlap(
        existing.doctorId, 
        newDayOfWeek, 
        newStartTime, 
        newEndTime, 
        newEffectiveFrom,
        newEffectiveUntil,
        newPriority,
        id
      );
    }

    // Validate IN_CLINIC requires hospitalId (skip for BLOCK_OUT)
    const newAppointmentType = dto.appointmentType ?? existing.appointmentType;
    const newHospitalId = dto.hospitalId !== undefined ? dto.hospitalId : existing.hospitalId;
    if (newScheduleType !== ScheduleType.BLOCK_OUT) {
      if (newAppointmentType === AppointmentTypeEnum.IN_CLINIC && !newHospitalId) {
        throw new BadRequestException('Khám tại phòng khám yêu cầu chọn bệnh viện/phòng khám');
      }
    }

    const updateData: Partial<DoctorSchedule> = {
      ...dto,
      priority: newPriority,
      isAvailable: newIsAvailable,
      consultationFee: dto.consultationFee !== undefined 
        ? (dto.consultationFee?.toString() ?? null)
        : undefined,
      effectiveFrom: dto.effectiveFrom !== undefined 
        ? (dto.effectiveFrom ? new Date(dto.effectiveFrom) : null)
        : undefined,
      effectiveUntil: dto.effectiveUntil !== undefined 
        ? (dto.effectiveUntil ? new Date(dto.effectiveUntil) : null)
        : undefined,
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await this.scheduleRepository.update(id, updateData);
    const updated = await this.scheduleRepository.findOne({ where: { id } });
    return new ResponseCommon(200, 'Cập nhật lịch làm việc thành công', updated!);
  }

  async delete(id: string): Promise<ResponseCommon<null>> {
    const scheduleResult = await this.findById(id);
    await this.scheduleRepository.remove(scheduleResult.data!);
    return new ResponseCommon(200, 'Xóa lịch làm việc thành công', null);
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
      .andWhere('(schedule.effectiveFrom IS NULL OR schedule.effectiveFrom <= :lookAheadDate)', { lookAheadDate })
      .andWhere('(schedule.effectiveUntil IS NULL OR schedule.effectiveUntil >= :today)', { today });

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
  async getEffectiveConsultationFee(schedule: DoctorSchedule): Promise<string | null> {
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
    const effectiveConsultationFee = await this.getEffectiveConsultationFee(schedule);
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
    const doctorIds = [...new Set(schedules.map(s => s.doctorId))];
    
    // Batch fetch doctors
    const doctors = await this.doctorRepository
      .createQueryBuilder('doctor')
      .select(['doctor.id', 'doctor.defaultConsultationFee'])
      .whereInIds(doctorIds)
      .getMany();

    const doctorFeeMap = new Map(doctors.map(d => [d.id, d.defaultConsultationFee]));

    return schedules.map(schedule => ({
      ...schedule,
      effectiveConsultationFee: schedule.consultationFee ?? doctorFeeMap.get(schedule.doctorId) ?? null,
    }));
  }
}
