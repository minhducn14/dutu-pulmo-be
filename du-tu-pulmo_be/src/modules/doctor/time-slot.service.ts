import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, MoreThanOrEqual } from 'typeorm';
import { TimeSlot } from './entities/time-slot.entity';
import { CreateTimeSlotDto, UpdateTimeSlotDto } from './dto/time-slot.dto';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { DoctorSchedule } from './entities/doctor-schedule.entity';

// Constants for slot limits
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

  async findByDoctorId(doctorId: string, limit = 100, offset = 0): Promise<ResponseCommon<TimeSlot[]>> {
    const now = new Date();
    const slots = await this.timeSlotRepository.find({
      where: { 
        doctorId,
        startTime: MoreThanOrEqual(now),
      },
      order: { startTime: 'ASC' },
      // take: limit,
      // skip: offset,
    });
    return new ResponseCommon(200, 'SUCCESS', slots);
  }

  async findAvailableSlots(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<TimeSlot[]> {
    // Add future-only filter
    const now = new Date();
    const effectiveStart = startDate > now ? startDate : now;

    return this.timeSlotRepository.find({
      where: {
        doctorId,
        isAvailable: true,
        startTime: Between(effectiveStart, endDate),
      },
      order: { startTime: 'ASC' },
      take: 100, // Limit results
    });
  }

  /**
   * Find ALL slots in a date range (regardless of isAvailable).
   * Used by slot generator to prevent overlap with existing slots.
   */
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

  async findAvailableSlotsByDate(doctorId: string, date: Date): Promise<ResponseCommon<TimeSlot[]>> {
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Ngày không hợp lệ');
    }

    const now = new Date();
    const queryDate = new Date(date);
    queryDate.setHours(0, 0, 0, 0);
    
    // ✅ Check nếu date là quá khứ
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

  /**
   * Check for overlapping time slots
   */
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
        `Time slot trùng với slot hiện có (${overlapping.startTime.toISOString()} - ${overlapping.endTime.toISOString()})`
      );
    }
  }

  /**
   * Validate slot data
   */
  private validateSlot(dto: CreateTimeSlotDto, doctorSchedule?: DoctorSchedule): void {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);
    const now = new Date();

    if (startTime >= endTime) {
      throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc');
    }

    // ✅ Sử dụng minimumBookingTime từ schedule (nếu có)
    const minBookingHours = doctorSchedule?.minimumBookingTime || 1;
    const minBookingBufferMs = minBookingHours * 60 * 60 * 1000;
    const earliestAllowed = new Date(now.getTime() + minBookingBufferMs);
    
    if (startTime < earliestAllowed) {
      throw new BadRequestException(
        `Slot phải bắt đầu sau ${earliestAllowed.toISOString()} (tối thiểu ${minBookingHours} giờ từ hiện tại)`
      );
    }

    // ✅ Sử dụng maxAdvanceBookingDays từ schedule (nếu có)
    const maxAdvanceDays = doctorSchedule?.maxAdvanceBookingDays || 90;
    const maxDate = new Date(now.getTime() + maxAdvanceDays * 24 * 60 * 60 * 1000);
    
    if (startTime > maxDate) {
      throw new BadRequestException(`Không thể tạo slot quá ${maxAdvanceDays} ngày trong tương lai`);
    }

    // ✅ Validate appointment types
    if (dto.allowedAppointmentTypes.includes(AppointmentTypeEnum.IN_CLINIC) && !dto.locationHospitalId) {
      throw new BadRequestException('Khám tại phòng khám yêu cầu chọn địa điểm');
    }

    // ✅ Validate có ít nhất 1 appointment type
    if (!dto.allowedAppointmentTypes || dto.allowedAppointmentTypes.length === 0) {
      throw new BadRequestException('Phải có ít nhất 1 loại hình khám');
    }
  }

  /**
   * Count slots for a specific date
   */
  private async countSlotsForDate(doctorId: string, date: Date): Promise<number> {
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

  async create(doctorId: string, dto: CreateTimeSlotDto): Promise<ResponseCommon<TimeSlot>> {
    this.validateSlot(dto);

    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    // Check overlap
    await this.checkOverlap(doctorId, startTime, endTime);

    // Check max slots per day
    const existingCount = await this.countSlotsForDate(doctorId, startTime);
    if (existingCount >= MAX_SLOTS_PER_DAY) {
      throw new BadRequestException(`Tối đa ${MAX_SLOTS_PER_DAY} slots mỗi ngày`);
    }

    const slot = this.timeSlotRepository.create({
      doctorId,
      startTime,
      endTime,
      locationHospitalId: dto.locationHospitalId,
      allowedAppointmentTypes: dto.allowedAppointmentTypes,
      capacity: dto.capacity ?? 1,
      isAvailable: dto.isAvailable ?? true,
    });

    const saved = await this.timeSlotRepository.save(slot);
    return new ResponseCommon(201, 'Tạo time slot thành công', saved);
  }

  /**
   * Bulk create with transaction wrapper for atomicity.
   * Uses bulk overlap check instead of sequential queries.
   */
  async createMany(doctorId: string, dtos: CreateTimeSlotDto[]): Promise<ResponseCommon<TimeSlot[]>> {
    // Validate request size
    if (dtos.length > MAX_SLOTS_PER_REQUEST) {
      throw new BadRequestException(`Tối đa ${MAX_SLOTS_PER_REQUEST} slots mỗi request`);
    }

    if (dtos.length === 0) {
      throw new BadRequestException('Danh sách slots không được rỗng');
    }

    // ✅ Check duplicate trong batch
    const timeRanges: Array<{ startTime: Date; endTime: Date }> = [];
    const slotsByDate = new Map<string, number>();
    const seenSlots = new Set<string>();

    for (const dto of dtos) {
      this.validateSlot(dto);
      
      const startTime = new Date(dto.startTime);
      const endTime = new Date(dto.endTime);
      
      // ✅ Check duplicate trong batch
      const slotKey = `${startTime.getTime()}-${endTime.getTime()}`;
      if (seenSlots.has(slotKey)) {
        throw new BadRequestException(`Phát hiện slot trùng lặp trong batch: ${dto.startTime}`);
      }
      seenSlots.add(slotKey);
      
      timeRanges.push({ startTime, endTime });
      
      const dateKey = startTime.toISOString().split('T')[0];
      slotsByDate.set(dateKey, (slotsByDate.get(dateKey) || 0) + 1);
    }

    // Check existing slot counts per day
    for (const [dateKey, newCount] of slotsByDate.entries()) {
      const date = new Date(dateKey);
      const existingCount = await this.countSlotsForDate(doctorId, date);

      const totalSlots = existingCount + newCount;
      if (totalSlots > MAX_SLOTS_PER_DAY) {
        throw new BadRequestException(
          `Tối đa ${MAX_SLOTS_PER_DAY} slots mỗi ngày. Ngày ${dateKey} đang có ${existingCount}, không thể thêm ${newCount} slots.`
        );
      }
    }

    // ✅ Bulk overlap check với existing slots
    await this.checkOverlapBulk(doctorId, timeRanges);

    // ✅ Wrap in transaction và INSERT thật sự
    const result = await this.dataSource.transaction(async (manager) => {
      const entities = dtos.map(dto => 
        manager.create(TimeSlot, {
          doctorId,
          startTime: new Date(dto.startTime),
          endTime: new Date(dto.endTime),
          locationHospitalId: dto.locationHospitalId,
          allowedAppointmentTypes: dto.allowedAppointmentTypes,
          capacity: dto.capacity ?? 1,
          isAvailable: dto.isAvailable ?? true,
          bookedCount: 0,
        })
      );

      // ✅ Save toàn bộ, nếu có conflict → throw error rõ ràng
      // Không dùng orIgnore() nữa
      return manager.save(TimeSlot, entities);
    });

    return new ResponseCommon(
      201, 
      `Tạo ${result.length} time slots thành công`, 
      result
    );
  }

  /**
   * Check overlaps for multiple time ranges in single query.
   * Replaces O(n) sequential queries with O(1) bulk query.
   */
  private async checkOverlapBulk(
    doctorId: string,
    timeRanges: Array<{ startTime: Date; endTime: Date }>,
  ): Promise<void> {
    if (timeRanges.length === 0) return;

    // ✅ Tìm min/max time trong batch
    const minStart = timeRanges.reduce((min, r) => r.startTime < min ? r.startTime : min, timeRanges[0].startTime);
    const maxEnd = timeRanges.reduce((max, r) => r.endTime > max ? r.endTime : max, timeRanges[0].endTime);

    // ✅ Lấy TẤT CẢ existing slots trong khoảng min-max
    const existingSlots = await this.timeSlotRepository.find({
      where: {
        doctorId,
        startTime: Between(minStart, maxEnd),
      },
      select: ['startTime', 'endTime'],
    });

    // ✅ Check overlap in-memory (nhanh hơn database)
    for (const newSlot of timeRanges) {
      const overlapping = existingSlots.  find(existing =>
        newSlot.startTime < existing.endTime && newSlot.endTime > existing.startTime
      );

      if (overlapping) {
        throw new ConflictException(
          `Phát hiện slot trùng: ${overlapping.startTime.toISOString()} - ${overlapping.endTime.toISOString()}`
        );
      }
    }
  }

  /**
   * Book a slot with atomic operation and pessimistic lock.
   * Prevents race conditions when multiple users try to book the same slot.
   */
  async bookSlot(slotId: string, appointmentId: string): Promise<ResponseCommon<TimeSlot>> {
    const result = await this.dataSource.transaction('READ COMMITTED', async (transactionalEntityManager) => {
      // Lock the row for update
      const slot = await transactionalEntityManager.findOne(TimeSlot, {
        where: { id: slotId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!slot) {
        throw new NotFoundException(`Không tìm thấy time slot với ID ${slotId}`);
      }

      if (!slot.isAvailable) {
        throw new ConflictException('Time slot không còn trống');
      }

      // Check capacity
      if (slot.bookedCount + 1 > slot.capacity) {
        throw new ConflictException('Time slot đã đầy');
      }

      // Check if slot is in the past
      if (slot.startTime < new Date()) {
        throw new BadRequestException('Không thể đặt slot đã qua');
      }

      const newBookedCount = slot.bookedCount + 1;
      // isAvailable = false only when slot is completely full
      const isStillAvailable = newBookedCount < slot.capacity;

      slot.bookedCount = newBookedCount;
      slot.isAvailable = isStillAvailable;

      return transactionalEntityManager.save(slot);
    });

    return new ResponseCommon(200, 'Đặt lịch thành công', result);
  }

  /**
   * Cancel a booking with atomic operation.
   */
  async cancelBooking(slotId: string): Promise<ResponseCommon<TimeSlot>> {
    const result = await this.dataSource.transaction('READ COMMITTED', async (transactionalEntityManager) => {
      const slot = await transactionalEntityManager.findOne(TimeSlot, {
        where: { id: slotId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!slot) {
        throw new NotFoundException(`Không tìm thấy time slot với ID ${slotId}`);
      }

      if (slot.bookedCount <= 0) {
        throw new ConflictException('Time slot không có booking để hủy');
      }

      slot.bookedCount -= 1;
      slot.isAvailable = true;

      return transactionalEntityManager.save(slot);
    });

    return new ResponseCommon(200, 'Hủy lịch thành công', result);
  }

  async update(id: string, dto: UpdateTimeSlotDto): Promise<ResponseCommon<TimeSlot>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    // If time changed, validate and check overlap
    if (dto.startTime || dto.endTime) {
      const startTime = dto.startTime ? new Date(dto.startTime) : existing.startTime;
      const endTime = dto.endTime ? new Date(dto.endTime) : existing.endTime;

      if (startTime >= endTime) {
        throw new BadRequestException('Thời gian bắt đầu phải trước thời gian kết thúc');
      }

      await this.checkOverlap(existing.doctorId, startTime, endTime, id);
    }

    // Validate IN_CLINIC requires hospitalId
    const newAppointmentTypes = dto.allowedAppointmentTypes ?? existing.allowedAppointmentTypes;
    const newLocationHospitalId = dto.locationHospitalId !== undefined 
      ? dto.locationHospitalId 
      : existing.locationHospitalId;

    if (newAppointmentTypes.includes(AppointmentTypeEnum.IN_CLINIC) && !newLocationHospitalId) {
      throw new BadRequestException('Khám tại phòng khám yêu cầu chọn địa điểm');
    }

    const updateData: Partial<TimeSlot> = {
      ...(dto.startTime && { startTime: new Date(dto.startTime) }),
      ...(dto.endTime && { endTime: new Date(dto.endTime) }),
      ...(dto.locationHospitalId !== undefined && { locationHospitalId: dto.locationHospitalId }),
      ...(dto.allowedAppointmentTypes && { allowedAppointmentTypes: dto.allowedAppointmentTypes }),
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
    
    // Cannot delete slot with bookings
    if (slot.bookedCount > 0) {
      throw new ConflictException('Không thể xóa slot đã có booking');
    }

    await this.timeSlotRepository.remove(slot);
    return new ResponseCommon(200, 'Xóa time slot thành công', null);
  }

  async deleteByDoctorId(doctorId: string): Promise<ResponseCommon<null>> {
    // Only delete slots without bookings
    await this.timeSlotRepository
      .createQueryBuilder()
      .delete()
      .where('doctorId = :doctorId', { doctorId })
      .andWhere('bookedCount = 0')
      .execute();
    return new ResponseCommon(200, 'Xóa các time slots thành công', null);
  }
}
