import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  DataSource,
  EntityManager,
  MoreThanOrEqual,
  In,
  SelectQueryBuilder,
} from 'typeorm';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import {
  CreateTimeSlotDto,
  UpdateTimeSlotDto,
} from '@/modules/doctor/dto/time-slot.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { vnNow, startOfDayVN, endOfDayVN } from '@/common/datetime';
import { ConsultationPricingService } from '@/modules/doctor/services/consultation-pricing.service';
import {
  AppointmentTypeFilterEnum,
  mapAppointmentTypeFilterToSlotType,
} from '@/modules/doctor/dto/appointment-type-filter.enum';

const MAX_SLOTS_PER_REQUEST = 100;
const MAX_SLOTS_PER_DAY = 50;

interface AvailabilitySummaryRaw {
  date: string;
  count: string;
}
@Injectable()
export class TimeSlotService {
  private readonly logger = new Logger(TimeSlotService.name);
  constructor(
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    private readonly dataSource: DataSource,
    private readonly pricingService: ConsultationPricingService,
  ) {}

  async findById(id: string): Promise<ResponseCommon<TimeSlot>> {
    const slot = await this.timeSlotRepository.findOne({
      where: { id },
      relations: ['doctor', 'schedule'],
    });
    if (!slot) {
      this.logger.error('Slot not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }
    const [enriched] = await this.enrichSlotsWithPricing([slot]);
    return new ResponseCommon(200, 'SUCCESS', enriched);
  }

  async findByDoctorAndId(
    doctorId: string,
    id: string,
  ): Promise<ResponseCommon<TimeSlot>> {
    const slot = await this.timeSlotRepository.findOne({
      where: { id, doctorId },
      relations: ['doctor', 'schedule'],
    });
    if (!slot) {
      this.logger.error('Slot not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }
    const [enriched] = await this.enrichSlotsWithPricing([slot]);
    return new ResponseCommon(200, 'SUCCESS', enriched);
  }

  async findByIdWithRelations(id: string): Promise<ResponseCommon<TimeSlot>> {
    const slot = await this.timeSlotRepository.findOne({
      where: { id },
      relations: ['doctor', 'schedule', 'appointments'],
    });
    if (!slot) {
      this.logger.error('Slot not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }
    const [enriched] = await this.enrichSlotsWithPricing([slot]);
    return new ResponseCommon(200, 'SUCCESS', enriched);
  }

  async findByDoctorId(doctorId: string): Promise<ResponseCommon<TimeSlot[]>> {
    const now = vnNow();
    const slots = await this.timeSlotRepository.find({
      where: {
        doctorId,
        startTime: MoreThanOrEqual(now),
        isAvailable: true,
      },
      order: { startTime: 'ASC' },
    });
    const filteredSlots = slots.filter((s) => s.bookedCount < s.capacity);
    const enrichedSlots = await this.enrichSlotsWithPricing(filteredSlots);
    return new ResponseCommon(200, 'SUCCESS', enrichedSlots);
  }

  private buildAvailableSlotQuery(
    doctorId: string,
    effectiveStart: Date,
    effectiveEnd: Date,
    now: Date,
    appointmentType?: AppointmentTypeFilterEnum,
  ): SelectQueryBuilder<TimeSlot> {
    const qb = this.timeSlotRepository
      .createQueryBuilder('slot')
      .leftJoin('slot.schedule', 'schedule')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.startTime BETWEEN :effectiveStart AND :effectiveEnd', {
        effectiveStart,
        effectiveEnd,
      })
      .andWhere('slot.isAvailable = true')
      .andWhere('slot.bookedCount < slot.capacity')
      .andWhere(
        `slot.startTime >= :now::timestamptz + COALESCE(schedule.minimumBookingTime, 0) * interval '1 minute'`,
        { now },
      )
      .andWhere(
        `slot.startTime <= :now::timestamptz + COALESCE(schedule.maxAdvanceBookingDays, 30) * interval '1 day'`,
        { now },
      );

    const slotType = mapAppointmentTypeFilterToSlotType(appointmentType);
    if (slotType) {
      qb.andWhere(':slotType = ANY(slot.allowedAppointmentTypes)', {
        slotType,
      });
    }

    return qb;
  }

  async findAvailableSlots(
    doctorId: string,
    startDate: Date,
    endDate: Date,
    appointmentType: AppointmentTypeFilterEnum = AppointmentTypeFilterEnum.ALL,
  ): Promise<TimeSlot[]> {
    const now = vnNow();
    const effectiveStart = startDate > now ? startDate : now;

    return this.buildAvailableSlotQuery(
      doctorId,
      effectiveStart,
      endDate,
      now,
      appointmentType,
    )
      .orderBy('slot.startTime', 'ASC')
      .getMany()
      .then((slots) => this.enrichSlotsWithPricing(slots));
  }

  async findSlotsInRange(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeSlot[]> {
    return this.timeSlotRepository
      .createQueryBuilder('slot')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.startTime < :endDate', { endDate })
      .andWhere('slot.endTime > :startDate', { startDate })
      .orderBy('slot.startTime', 'ASC')
      .getMany();
  }

  async findAvailableSlotsByDate(
    doctorId: string,
    date: Date,
    appointmentType: AppointmentTypeFilterEnum = AppointmentTypeFilterEnum.ALL,
  ): Promise<ResponseCommon<TimeSlot[]>> {
    if (isNaN(date.getTime())) {
      this.logger.error('Invalid date');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const now = vnNow();
    const todayStart = startOfDayVN(now);
    const queryDate = startOfDayVN(date);

    if (queryDate < todayStart) {
      return new ResponseCommon(200, 'Ngày đã qua', []);
    }

    const dayStart = startOfDayVN(date);
    const dayEnd = endOfDayVN(date);

    const slots = await this.findAvailableSlots(
      doctorId,
      dayStart,
      dayEnd,
      appointmentType,
    );
    return new ResponseCommon(200, 'SUCCESS', slots);
  }

  private async enrichSlotsWithPricing(slots: TimeSlot[]): Promise<TimeSlot[]> {
    if (slots.length === 0) return slots;
    const ids = slots.map((slot) => slot.id);
    const batchSize = 500;
    if (ids.length > batchSize) {
      this.logger.warn(
        `enrichSlotsWithPricing called with ${ids.length} slots; querying in batches of ${batchSize}`,
      );
    }

    const rawRows: Array<{
      slot_id: string;
      schedule_consultation_fee: string | null;
      schedule_discount_percent: number | null;
      doctor_default_fee: string | null;
    }> = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      const batchRows = await this.timeSlotRepository
        .createQueryBuilder('slot')
        .leftJoin('slot.schedule', 'schedule')
        .leftJoin('slot.doctor', 'doctor')
        .select('slot.id', 'slot_id')
        .addSelect('schedule.consultationFee', 'schedule_consultation_fee')
        .addSelect('schedule.discountPercent', 'schedule_discount_percent')
        .addSelect('doctor.defaultConsultationFee', 'doctor_default_fee')
        .where('slot.id IN (:...ids)', { ids: batchIds })
        .getRawMany<{
          slot_id: string;
          schedule_consultation_fee: string | null;
          schedule_discount_percent: number | null;
          doctor_default_fee: string | null;
        }>();
      rawRows.push(...batchRows);
    }

    const feeMap = new Map(
      rawRows.map((row) => {
        // schedule can be null; fallback to doctor default fee.
        const baseFee = this.pricingService.resolveBaseFee(
          row.schedule_consultation_fee,
          row.doctor_default_fee,
        );
        const pricing = this.pricingService.calculateFinalFee(
          baseFee,
          row.schedule_discount_percent,
        );
        return [
          row.slot_id,
          {
            baseConsultationFee:
              pricing.baseFee > 0
                ? this.pricingService.toVndString(pricing.baseFee)
                : null,
            discountPercent: pricing.discountPercent,
            finalConsultationFee: this.pricingService.toVndString(
              pricing.finalFee,
            ),
            currency: 'VND' as const,
          },
        ];
      }),
    );

    return slots.map((slot) =>
      Object.assign(
        slot,
        feeMap.get(slot.id) ?? {
          baseConsultationFee: null,
          discountPercent: 0,
          finalConsultationFee: '0',
          currency: 'VND' as const,
        },
      ),
    );
  }

  private async checkOverlap(
    doctorId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string,
  ): Promise<void> {
    const queryBuilder = this.timeSlotRepository
      .createQueryBuilder('slot')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.startTime < :endTime', { endTime })
      .andWhere('slot.endTime > :startTime', { startTime });

    if (excludeId) {
      queryBuilder.andWhere('slot.id != :excludeId', { excludeId });
    }

    const overlapping = await queryBuilder.getOne();

    if (overlapping) {
      throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
    }
  }

  private validateSlot(
    dto: CreateTimeSlotDto,
    doctorSchedule?: DoctorSchedule,
  ): void {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const now = vnNow();

    if (startTime >= endTime) {
      this.logger.error('Invalid time range');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    // minimumBookingTime is stored in MINUTES in the DB
    // Behavior Note: Using ?? 0 means if no minimumBookingTime is set, slots can be booked immediately.
    const minBookingMinutes = doctorSchedule?.minimumBookingTime ?? 0;
    const minBookingBufferMs = minBookingMinutes * 60 * 1000;
    const earliestAllowed = new Date(now.getTime() + minBookingBufferMs);

    if (startTime < earliestAllowed) {
      this.logger.error(
        'Invalid time range. Start time is before earliest allowed',
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const maxAdvanceDays = doctorSchedule?.maxAdvanceBookingDays ?? 30;
    const maxDate = new Date(
      now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000,
    );

    if (startTime > maxDate) {
      this.logger.error(
        'Invalid time range. Start time is after max advance days',
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    this.validateAppointmentTypes(dto.allowedAppointmentTypes);
  }

  private async countSlotsForDate(
    doctorId: string,
    date: Date,
  ): Promise<number> {
    const startOfDay = startOfDayVN(date);
    const endOfDay = endOfDayVN(date);

    return this.timeSlotRepository.count({
      where: {
        doctorId,
        startTime: Between(startOfDay, endOfDay),
      },
    });
  }

  async create(
    doctorId: string,
    dto: CreateTimeSlotDto,
  ): Promise<ResponseCommon<TimeSlot>> {
    let doctorSchedule: DoctorSchedule | null = null;
    if (dto.scheduleId) {
      doctorSchedule = await this.scheduleRepository.findOne({
        where: { id: dto.scheduleId, doctorId },
        select: [
          'id',
          'doctorId',
          'version',
          'minimumBookingTime',
          'maxAdvanceBookingDays',
        ],
      });

      if (!doctorSchedule) {
        this.logger.error('Schedule not found for doctor');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      // Validate version match if provided
      if (dto.scheduleVersion !== undefined) {
        if (dto.scheduleVersion !== doctorSchedule.version) {
          this.logger.error('Invalid schedule version');
          throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }
      }
    }

    this.validateSlot(dto, doctorSchedule ?? undefined);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    await this.checkOverlap(doctorId, startTime, endTime);

    const existingCount = await this.countSlotsForDate(doctorId, startTime);
    if (existingCount >= MAX_SLOTS_PER_DAY) {
      this.logger.error('Invalid time range. Too many slots for this day');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const slot = this.timeSlotRepository.create({
      doctorId,
      startTime,
      endTime,
      allowedAppointmentTypes: dto.allowedAppointmentTypes,
      capacity: dto.capacity ?? 1,
      isAvailable: dto.isAvailable ?? true,
      scheduleId: dto.scheduleId ?? null,
      scheduleVersion: doctorSchedule?.version ?? null,
    });

    const saved = await this.timeSlotRepository.save(slot);
    return new ResponseCommon(201, 'Tạo time slot thành công', saved);
  }

  async createMany(
    doctorId: string,
    dtos: CreateTimeSlotDto[],
  ): Promise<ResponseCommon<TimeSlot[]>> {
    if (dtos.length > MAX_SLOTS_PER_REQUEST) {
      this.logger.error('Invalid request. Too many slots to create');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (dtos.length === 0) {
      this.logger.error('Invalid request. No slots to create');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const timeRanges: Array<{ startTime: Date; endTime: Date }> = [];
    const slotsByDate = new Map<string, number>();
    const seenSlots = new Set<string>();

    // Collect unique scheduleIds from DTOs
    const scheduleIds = [
      ...new Set(dtos.map((dto) => dto.scheduleId).filter(Boolean)),
    ] as string[];

    // Batch fetch all schedules
    const scheduleMap = new Map<string, DoctorSchedule>();
    if (scheduleIds.length > 0) {
      const schedules = await this.scheduleRepository.find({
        where: { id: In(scheduleIds), doctorId },
        select: [
          'id',
          'doctorId',
          'version',
          'minimumBookingTime',
          'maxAdvanceBookingDays',
        ],
      });
      schedules.forEach((s) => scheduleMap.set(s.id, s));

      if (schedules.length !== scheduleIds.length) {
        this.logger.error('One or more schedules are invalid for doctor');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    for (const dto of dtos) {
      // Get schedule for this DTO if it has scheduleId
      const schedule = dto.scheduleId
        ? scheduleMap.get(dto.scheduleId)
        : undefined;
      if (dto.scheduleId && !schedule) {
        this.logger.error('Schedule not found for doctor');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
      if (
        dto.scheduleVersion !== undefined &&
        schedule &&
        dto.scheduleVersion !== schedule.version
      ) {
        this.logger.error('Invalid schedule version');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
      this.validateSlot(dto, schedule);

      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);

      const slotKey = `${startTime.getTime()}-${endTime.getTime()}`;
      if (seenSlots.has(slotKey)) {
        this.logger.error('Invalid request. Duplicate slot');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
      seenSlots.add(slotKey);

      timeRanges.push({ startTime, endTime });

      const dateKey = startTime.toISOString().split('T')[0];
      slotsByDate.set(dateKey, (slotsByDate.get(dateKey) || 0) + 1);
    }

    for (const [dateKey, newCount] of slotsByDate.entries()) {
      const date = new Date(dateKey);
      const existingCount = await this.countSlotsForDate(doctorId, date);

      const totalSlots = existingCount + newCount;
      if (totalSlots > MAX_SLOTS_PER_DAY) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    await this.checkOverlapBulk(doctorId, timeRanges);

    const result = await this.dataSource.transaction(async (manager) => {
      const entities = dtos.map((dto) => {
        const schedule = dto.scheduleId
          ? scheduleMap.get(dto.scheduleId)
          : undefined;

        return manager.create(TimeSlot, {
          doctorId,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          allowedAppointmentTypes: dto.allowedAppointmentTypes,
          capacity: dto.capacity ?? 1,
          isAvailable: dto.isAvailable ?? true,
          bookedCount: 0,
          scheduleId: dto.scheduleId ?? null,
          scheduleVersion: schedule?.version ?? null,
        });
      });

      return manager.save(TimeSlot, entities);
    });

    return new ResponseCommon(
      201,
      `Tạo ${result.length} time slots thành công`,
      result,
    );
  }

  private async checkOverlapBulk(
    doctorId: string,
    timeRanges: Array<{ startTime: Date; endTime: Date }>,
  ): Promise<void> {
    if (timeRanges.length === 0) return;

    const minStart = timeRanges.reduce(
      (min, r) => (r.startTime < min ? r.startTime : min),
      timeRanges[0].startTime,
    );
    const maxEnd = timeRanges.reduce(
      (max, r) => (r.endTime > max ? r.endTime : max),
      timeRanges[0].endTime,
    );

    const existingSlots = await this.timeSlotRepository
      .createQueryBuilder('slot')
      .select(['slot.startTime', 'slot.endTime'])
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.startTime < :maxEnd', { maxEnd })
      .andWhere('slot.endTime > :minStart', { minStart })
      .getMany();

    for (const newSlot of timeRanges) {
      const overlapping = existingSlots.find(
        (existing) =>
          existing.startTime < maxEnd &&
          existing.endTime > minStart &&
          newSlot.startTime < existing.endTime &&
          newSlot.endTime > existing.startTime,
      );

      if (overlapping) {
        throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
      }
    }
  }

  async toggleSlotAvailability(
    slotId: string,
    isAvailable: boolean,
  ): Promise<ResponseCommon<TimeSlot>> {
    const slotResult = await this.findById(slotId);
    const slot = slotResult.data!;

    if (!isAvailable && slot.bookedCount > 0) {
      this.logger.error(
        'Invalid request. Slot is not available but has booked count',
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    await this.timeSlotRepository.update(slotId, { isAvailable });

    const updated = await this.timeSlotRepository.findOne({
      where: { id: slotId },
    });

    const message = isAvailable
      ? 'Đã kích hoạt time slot'
      : 'Đã tắt time slot (không cho phép đặt lịch mới)';

    return new ResponseCommon(200, message, updated!);
  }

  async bulkToggleSlots(
    slotIds: string[],
    isAvailable: boolean,
  ): Promise<
    ResponseCommon<{ success: number; failed: number; errors: string[] }>
  > {
    if (slotIds.length === 0) {
      this.logger.error('Invalid request. No slots to toggle availability');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (slotIds.length > 100) {
      this.logger.error(
        'Invalid request. Too many slots to toggle availability',
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const slotId of slotIds) {
      try {
        const slot = await this.timeSlotRepository.findOne({
          where: { id: slotId },
        });

        if (!slot) {
          errors.push(`Slot ${slotId}: không tìm thấy`);
          failed++;
          continue;
        }

        if (!isAvailable && slot.bookedCount > 0) {
          errors.push(
            `Slot ${slotId}: có ${slot.bookedCount} booking, không thể tắt`,
          );
          failed++;
          continue;
        }

        await this.timeSlotRepository.update(slotId, { isAvailable });
        success++;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Lỗi không xác định';
        errors.push(`Slot ${slotId}: ${errorMessage}`);
        failed++;
      }
    }

    const message = `Hoàn tất: ${success} thành công, ${failed} thất bại`;
    return new ResponseCommon(200, message, { success, failed, errors });
  }

  /**
   * Helper - Tắt tất cả slots của bác sĩ trong 1 ngày
   */
  async disableSlotsForDay(
    doctorId: string,
    dateStr: string,
  ): Promise<
    ResponseCommon<{ success: number; failed: number; errors: string[] }>
  > {
    const targetDate = new Date(dateStr);

    if (isNaN(targetDate.getTime())) {
      this.logger.error('Invalid request. Invalid date');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all slots for that day
    const slots = await this.timeSlotRepository.find({
      where: {
        doctorId,
        startTime: Between(startOfDay, endOfDay),
      },
      select: ['id'],
    });

    const slotIds = slots.map((s) => s.id);

    if (slotIds.length === 0) {
      return new ResponseCommon(200, 'Không có slot nào trong ngày này', {
        success: 0,
        failed: 0,
        errors: [],
      });
    }

    return this.bulkToggleSlots(slotIds, false);
  }

  async update(
    id: string,
    dto: UpdateTimeSlotDto,
  ): Promise<ResponseCommon<TimeSlot>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    if (dto.startTime || dto.endTime) {
      const startTime = dto.startTime
        ? new Date(dto.startTime)
        : existing.startTime;
      const endTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;

      if (startTime >= endTime) {
        this.logger.error('Invalid request. Invalid time range');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      await this.checkOverlap(existing.doctorId, startTime, endTime, id);
    }

    if (dto.isAvailable === false && existing.bookedCount > 0) {
      this.logger.error(
        'Invalid request. Slot is not available but has booked count',
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const updateData: Partial<TimeSlot> = {
      ...(dto.startTime && { startTime: new Date(dto.startTime) }),
      ...(dto.endTime && { endTime: new Date(dto.endTime) }),
      ...(dto.capacity !== undefined && { capacity: dto.capacity }),
      ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
    };

    await this.timeSlotRepository.update(id, updateData);
    const updated = await this.timeSlotRepository.findOne({ where: { id } });
    return new ResponseCommon(200, 'Cập nhật time slot thành công', updated!);
  }

  async delete(id: string): Promise<ResponseCommon<null>> {
    const slotResult = await this.findById(id);
    const slot = slotResult.data!;

    if (slot.bookedCount > 0) {
      this.logger.error('Invalid request. Slot has booked count');
      throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
    }

    // Soft delete để giữ lại history
    await this.timeSlotRepository.softRemove(slot);
    return new ResponseCommon(200, 'Xóa time slot thành công', null);
  }

  async deleteByDoctorId(doctorId: string): Promise<ResponseCommon<null>> {
    // Soft delete để giữ lại history
    await this.timeSlotRepository
      .createQueryBuilder()
      .softDelete()
      .where('doctorId = :doctorId', { doctorId })
      .andWhere('bookedCount = 0')
      .execute();
    return new ResponseCommon(200, 'Xóa các time slots thành công', null);
  }

  /**
   * Disable slots không thuộc schedules có priority cao nhất trong ngày
   * Chỉ disable slots chưa có booking
   */
  async disableSlotsNotInSchedules(
    doctorId: string,
    date: Date,
    scheduleIds: string[],
    manager?: EntityManager,
  ): Promise<number> {
    if (scheduleIds.length === 0) {
      return 0;
    }

    const startOfDay = startOfDayVN(date);
    const endOfDay = endOfDayVN(date);
    const slotRepository = (manager ?? this.dataSource.manager).getRepository(
      TimeSlot,
    );

    // Xây dựng query với điều kiện phức tạp
    const softDeleteResult = await slotRepository
      .createQueryBuilder()
      .softDelete()
      .from(TimeSlot)
      .where('doctorId = :doctorId', { doctorId })
      .andWhere('startTime >= :startOfDay', { startOfDay })
      .andWhere('startTime <= :endOfDay', { endOfDay })
      .andWhere('bookedCount = 0')
      .andWhere('"deleted_at" IS NULL')
      .andWhere('(scheduleId NOT IN (:...scheduleIds) OR scheduleId IS NULL)', {
        scheduleIds,
      })
      .execute();

    const disableQuery = slotRepository
      .createQueryBuilder()
      .update(TimeSlot)
      .set({ isAvailable: false })
      .where('doctorId = :doctorId', { doctorId })
      .andWhere('startTime >= :startOfDay', { startOfDay })
      .andWhere('startTime <= :endOfDay', { endOfDay })
      .andWhere('"deleted_at" IS NULL')
      .andWhere('isAvailable = true');

    // Disable slots KHÔNG thuộc scheduleIds này HOẶC không có scheduleId
    disableQuery.andWhere(
      '(scheduleId NOT IN (:...scheduleIds) OR scheduleId IS NULL)',
      { scheduleIds },
    );

    const disableResult = await disableQuery.execute();
    return (softDeleteResult.affected || 0) + (disableResult.affected || 0);
  }

  private validateAppointmentTypes(types: AppointmentTypeEnum[]): void {
    if (!types || types.length === 0) {
      this.logger.error('Invalid request. No appointment types provided');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const validTypes = Object.values(AppointmentTypeEnum);
    const invalidTypes = types.filter((type) => !validTypes.includes(type));

    if (invalidTypes.length > 0) {
      this.logger.error('Invalid request. Invalid appointment types');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }
  }

  async getAvailabilitySummary(
    doctorId: string,
    fromDate: Date,
    toDate: Date,
    appointmentType: AppointmentTypeFilterEnum = AppointmentTypeFilterEnum.ALL,
  ): Promise<ResponseCommon<any[]>> {
    const now = vnNow();
    const todayStart = startOfDayVN(now);
    const fromDateStart = startOfDayVN(fromDate);

    const effectiveStart =
      fromDateStart.getTime() === todayStart.getTime() ? now : fromDateStart;
    const effectiveEnd = endOfDayVN(toDate);

    const result = await this.buildAvailableSlotQuery(
      doctorId,
      effectiveStart,
      effectiveEnd,
      now,
      appointmentType,
    )
      .select(
        "TO_CHAR(slot.startTime AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')",
        'date',
      )
      .addSelect('COUNT(slot.id)', 'count')
      .groupBy(
        "TO_CHAR(slot.startTime AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')",
      )
      .orderBy(
        "TO_CHAR(slot.startTime AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')",
        'ASC',
      )
      .getRawMany<AvailabilitySummaryRaw>();

    const resultMap = new Map<string, number>();
    for (const item of result) {
      resultMap.set(item.date, parseInt(item.count, 10));
    }

    const summary: Array<{
      date: string;
      count: number;
      hasAvailability: boolean;
    }> = [];
    const cursor = endOfDayVN(fromDate);
    const rangeEnd = endOfDayVN(toDate);

    while (cursor <= rangeEnd) {
      const dateKey = cursor
        .toLocaleString('sv', { timeZone: 'Asia/Ho_Chi_Minh' })
        .split(' ')[0];
      const count = resultMap.get(dateKey) ?? 0;
      summary.push({ date: dateKey, count, hasAvailability: count > 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    return new ResponseCommon(200, 'SUCCESS', summary);
  }
}
