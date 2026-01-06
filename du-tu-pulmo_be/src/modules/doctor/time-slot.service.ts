import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, MoreThanOrEqual, Not, In, IsNull } from 'typeorm';
import { TimeSlot } from './entities/time-slot.entity';
import { CreateTimeSlotDto, UpdateTimeSlotDto } from './dto/time-slot.dto';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { DoctorSchedule } from './entities/doctor-schedule.entity';

const MAX_SLOTS_PER_REQUEST = 100;
const MAX_SLOTS_PER_DAY = 50;

@Injectable()
export class TimeSlotService {
  constructor(
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<ResponseCommon<TimeSlot>> {
    const slot = await this.timeSlotRepository.findOne({
      where: { id },
      relations: ['doctor'],
    });
    if (!slot) {
      throw new NotFoundException(`Không tìm thấy time slot với ID ${id}`);
    }
    return new ResponseCommon(200, 'SUCCESS', slot);
  }

  async findByDoctorId(
    doctorId: string,
    limit = 100,
    offset = 0,
  ): Promise<ResponseCommon<TimeSlot[]>> {
    const now = new Date();
    const slots = await this.timeSlotRepository.find({
      where: {
        doctorId,
        startTime: MoreThanOrEqual(now),
      },
      order: { startTime: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', slots);
  }

  async findAvailableSlots(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeSlot[]> {
    const now = new Date();
    const effectiveStart = startDate > now ? startDate : now;

    const slots = await this.timeSlotRepository.find({
      where: {
        doctorId,
        isAvailable: true,
        startTime: Between(effectiveStart, endDate),
      },
      order: { startTime: 'ASC' },
      take: 100,
    });

    return slots.filter((slot) => slot.bookedCount < slot.capacity);
  }

  async findSlotsInRange(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeSlot[]> {
    return this.timeSlotRepository.find({
      where: {
        doctorId,
        startTime: Between(startDate, endDate),
      },
      order: { startTime: 'ASC' },
    });
  }

  async findAvailableSlotsByDate(
    doctorId: string,
    date: Date,
  ): Promise<ResponseCommon<TimeSlot[]>> {
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }

    const now = new Date();
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);

    if (queryDate < new Date(now.setHours(0, 0, 0, 0))) {
      return new ResponseCommon(200, 'Ngày đã qua', []);
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const slots = await this.findAvailableSlots(doctorId, startOfDay, endOfDay);
    return new ResponseCommon(200, 'SUCCESS', slots);
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
      throw new ConflictException(
        `Time slot trùng với slot hiện có (${overlapping.startTime.toISOString()} - ${overlapping.endTime.toISOString()})`,
      );
    }
  }

  private validateSlot(
    dto: CreateTimeSlotDto,
    doctorSchedule?: DoctorSchedule,
  ): void {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const now = new Date();

    if (startTime >= endTime) {
      throw new BadRequestException(
        'Thời gian bắt đầu phải trước thời gian kết thúc',
      );
    }

    const minBookingHours = doctorSchedule?.minimumBookingTime || 1;
    const minBookingBufferMs = minBookingHours * 60 * 60 * 1000;
    const earliestAllowed = new Date(now.getTime() + minBookingBufferMs);

    if (startTime < earliestAllowed) {
      throw new BadRequestException(
        `Slot phải bắt đầu sau ${earliestAllowed.toISOString()} (tối thiểu ${minBookingHours} giờ từ hiện tại)`,
      );
    }

    const maxAdvanceDays = doctorSchedule?.maxAdvanceBookingDays || 90;
    const maxDate = new Date(
      now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000,
    );

    if (startTime > maxDate) {
      throw new BadRequestException(
        `Không thể tạo slot quá ${maxAdvanceDays} ngày trong tương lai`,
      );
    }

    if (
      !dto.allowedAppointmentTypes ||
      dto.allowedAppointmentTypes.length === 0
    ) {
      throw new BadRequestException('Phải có ít nhất 1 loại hình khám');
    }
  }

  private async countSlotsForDate(
    doctorId: string,
    date: Date,
  ): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

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
    this.validateSlot(dto);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    await this.checkOverlap(doctorId, startTime, endTime);

    const existingCount = await this.countSlotsForDate(doctorId, startTime);
    if (existingCount >= MAX_SLOTS_PER_DAY) {
      throw new BadRequestException(
        `Tối đa ${MAX_SLOTS_PER_DAY} slots mỗi ngày`,
      );
    }

    const slot = this.timeSlotRepository.create({
      doctorId,
      startTime,
      endTime,
      allowedAppointmentTypes: dto.allowedAppointmentTypes,
      capacity: dto.capacity ?? 1,
      isAvailable: dto.isAvailable ?? true,
      scheduleId: dto.scheduleId ?? null,
    });

    const saved = await this.timeSlotRepository.save(slot);
    return new ResponseCommon(201, 'Tạo time slot thành công', saved);
  }

  async createMany(
    doctorId: string,
    dtos: CreateTimeSlotDto[],
  ): Promise<ResponseCommon<TimeSlot[]>> {
    if (dtos.length > MAX_SLOTS_PER_REQUEST) {
      throw new BadRequestException(
        `Tối đa ${MAX_SLOTS_PER_REQUEST} slots mỗi request`,
      );
    }

    if (dtos.length === 0) {
      throw new BadRequestException('Danh sách slots không được rỗng');
    }

    const timeRanges: Array<{ startTime: Date; endTime: Date }> = [];
    const slotsByDate = new Map<string, number>();
    const seenSlots = new Set<string>();

    for (const dto of dtos) {
      this.validateSlot(dto);

      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);

      const slotKey = `${startTime.getTime()}-${endTime.getTime()}`;
      if (seenSlots.has(slotKey)) {
        throw new BadRequestException(
          `Phát hiện slot trùng lặp trong batch: ${dto.startTime}`,
        );
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
        throw new BadRequestException(
          `Tối đa ${MAX_SLOTS_PER_DAY} slots mỗi ngày. Ngày ${dateKey} đang có ${existingCount}, không thể thêm ${newCount} slots.`,
        );
      }
    }

    await this.checkOverlapBulk(doctorId, timeRanges);

    const result = await this.dataSource.transaction(async (manager) => {
      const entities = dtos.map((dto) =>
        manager.create(TimeSlot, {
          doctorId,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          allowedAppointmentTypes: dto.allowedAppointmentTypes,
          capacity: dto.capacity ?? 1,
          isAvailable: dto.isAvailable ?? true,
          bookedCount: 0,
          scheduleId: dto.scheduleId ?? null,
        }),
      );

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

    const existingSlots = await this.timeSlotRepository.find({
      where: {
        doctorId,
        startTime: Between(minStart, maxEnd),
      },
      select: ['startTime', 'endTime'],
    });

    for (const newSlot of timeRanges) {
      const overlapping = existingSlots.find(
        (existing) =>
          newSlot.startTime < existing.endTime &&
          newSlot.endTime > existing.startTime,
      );

      if (overlapping) {
        throw new ConflictException(
          `Phát hiện slot trùng: ${overlapping.startTime.toISOString()} - ${overlapping.endTime.toISOString()}`,
        );
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
      throw new BadRequestException(
        `Không thể tắt slot đã có ${slot.bookedCount} booking. Vui lòng hủy booking trước.`,
      );
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
      throw new BadRequestException('Danh sách slot IDs không được rỗng');
    }

    if (slotIds.length > 100) {
      throw new BadRequestException('Tối đa 100 slots mỗi lần');
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
        errors.push(`Slot ${slotId}: ${error.message}`);
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
      throw new BadRequestException('Ngày không hợp lệ');
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
        throw new BadRequestException(
          'Thời gian bắt đầu phải trước thời gian kết thúc',
        );
      }

      await this.checkOverlap(existing.doctorId, startTime, endTime, id);
    }

    const newAppointmentTypes =
      dto.allowedAppointmentTypes ?? existing.allowedAppointmentTypes;

    if (dto.isAvailable === false && existing.bookedCount > 0) {
      throw new BadRequestException(
        `Không thể tắt slot đã có ${existing.bookedCount} booking. Vui lòng hủy booking trước.`,
      );
    }

    const updateData: Partial<TimeSlot> = {
      ...(dto.startTime && { startTime: new Date(dto.startTime) }),
      ...(dto.endTime && { endTime: new Date(dto.endTime) }),
      ...(dto.allowedAppointmentTypes && {
        allowedAppointmentTypes: dto.allowedAppointmentTypes,
      }),
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
      throw new ConflictException('Không thể xóa slot đã có booking');
    }

    await this.timeSlotRepository.remove(slot);
    return new ResponseCommon(200, 'Xóa time slot thành công', null);
  }

  async deleteByDoctorId(doctorId: string): Promise<ResponseCommon<null>> {
    await this.timeSlotRepository
      .createQueryBuilder()
      .delete()
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
  ): Promise<number> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Xây dựng query với điều kiện phức tạp
    const queryBuilder = this.timeSlotRepository
      .createQueryBuilder()
      .update(TimeSlot)
      .set({ isAvailable: false })
      .where('doctorId = :doctorId', { doctorId })
      .andWhere('startTime >= :startOfDay', { startOfDay })
      .andWhere('startTime <= :endOfDay', { endOfDay })
      .andWhere('bookedCount = 0')
      .andWhere('isAvailable = true');

    if (scheduleIds.length > 0) {
      // Disable slots KHÔNG thuộc scheduleIds này HOẶC không có scheduleId
      queryBuilder.andWhere(
        '(scheduleId NOT IN (:...scheduleIds) OR scheduleId IS NULL)',
        { scheduleIds },
      );
    }

    const result = await queryBuilder.execute();
    return result.affected || 0;
  }
}
