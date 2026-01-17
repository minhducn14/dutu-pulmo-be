import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  Between,
  In,
  MoreThan,
  EntityManager,
} from 'typeorm';
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
import {
  PreviewFlexibleScheduleConflictsDto,
  PreviewTimeOffConflictsDto,
  PreviewConflictsResponseDto,
  ConflictingAppointmentDto,
} from './dto/preview-conflicts.dto';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from 'src/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import {
  SCHEDULE_TYPE_PRIORITY,
  ScheduleType,
} from 'src/modules/common/enums/schedule-type.enum';
import { NotificationService } from '../notification/notification.service';

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
    private readonly notificationService: NotificationService,
  ) {}

  // ========================================
  // COMMON QUERY METHODS
  // ========================================

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

  async findByIdWithTimeSlots(
    id: string,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: ['timeSlots'],
    });
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch với ID ${id}`);
    }
    return new ResponseCommon(200, 'SUCCESS', schedule);
  }

  async validateDoctorOwnership(
    scheduleId: string,
    doctorId: string,
  ): Promise<DoctorSchedule> {
    const result = await this.findById(scheduleId);
    const schedule = result.data!;

    if (schedule.doctorId !== doctorId) {
      throw new ForbiddenException('Bạn không có quyền thao tác với lịch này');
    }

    return schedule;
  }

  // ========================================
  // PRIVATE HELPERS
  // ========================================

  /**
   * Kiểm tra thời gian và slotDuration
   */
  private validateTimeRange(
    dto: CreateDoctorScheduleDto | UpdateDoctorScheduleDto,
  ): void {
    // Kiểm tra slotDuration
    if (dto.slotDuration !== undefined) {
      // Kiểm tra slotDuration hợp lệ
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

    // Kiểm tra startTime và endTime
    if (dto.startTime && dto.endTime) {
      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
      }

      // Kiểm tra thời gian làm việc có đủ cho 1 slot
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

    // Kiểm tra effectiveFrom và effectiveUntil có hợp lệ không
    if (dto.effectiveFrom && dto.effectiveUntil) {
      const from = new Date(dto.effectiveFrom);
      const until = new Date(dto.effectiveUntil);

      if (from >= until) {
        throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
      }
    }
  }

  /**
   * Kiểm tra minimumBookingDays và maxAdvanceBookingDays có hợp lệ không
   * minimumBookingDays phải nhỏ hơn maxAdvanceBookingDays
   */
  private validateBookingDaysConstraints(
    minimumBookingDays: number,
    maxAdvanceBookingDays: number,
  ): void {
    if (minimumBookingDays < 0 || maxAdvanceBookingDays < 0) {
      throw new BadRequestException(
        'Số ngày phải đặt trước và số ngày xa nhất phải lớn hơn hoặc bằng 0',
      );
    }

    if (minimumBookingDays >= maxAdvanceBookingDays) {
      throw new BadRequestException(
        `Cấu hình không hợp lệ: Số ngày phải đặt trước (${minimumBookingDays} ngày) ` +
          `không thể lớn hơn hoặc bằng số ngày xa nhất (${maxAdvanceBookingDays} ngày). ` +
          `Không có khoảng thời gian nào hợp lệ để đặt lịch.`,
      );
    }
  }

  /**
   * Kiểm tra xem có lịch trùng không
   */
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
      // Điều kiện 1: input.End >= s.Start (ví dụ: 19:00 >= 18:00)
      .andWhere('s.startTime < :endTime', { endTime })
      // Điều kiện 2: input.Start <= s.End (ví dụ: 17:00 <= 18:00)
      .andWhere('s.endTime > :startTime', { startTime })
      .andWhere('s.priority >= :priority', { priority })
      // Điều kiện 3: effectiveUntil >= s.effectiveFrom
      .andWhere(
        effectiveUntil
          ? '(s.effectiveFrom <= :effectiveUntil OR s.effectiveFrom IS NULL)'
          : '1=1',
        { effectiveUntil },
      )
      // Điều kiện 4: effectiveFrom <= s.effectiveUntil
      .andWhere(
        effectiveFrom
          ? '(s.effectiveUntil >= :effectiveFrom OR s.effectiveUntil IS NULL)'
          : '1=1',
        { effectiveFrom },
      );

    // Nếu có excludeId, không bao gồm lịch này
    if (excludeId) {
      queryBuilder.andWhere('s.id != :excludeId', { excludeId });
    }

    const overlapping = await queryBuilder.getOne();
    // Nếu có lịch trùng, throw error
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

  // ========================================
  // REGULAR SCHEDULE METHODS
  // ========================================

  /**
   * Tạo lịch cố định - lặp lại theo tuần
   */
  async createRegular(
    doctorId: string,
    dto: CreateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    // Xác minh doctorId tồn tại.
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });

    if (!doctor) {
      throw new NotFoundException('Bác sĩ không tồn tại');
    }

    // Gán giá trị mặc định cho scheduleType và priority
    const scheduleType = ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    // Kiểm tra ngày trong tuần hợp lệ
    if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
      throw new BadRequestException(
        'Ngày trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ 7)',
      );
    }

    // Kiểm tra slotDuration, startTime, endTime, effectiveFrom, effectiveUntil có hợp lệ không
    this.validateTimeRange(dto);

    // Kiểm tra minimumBookingDays và maxAdvanceBookingDays có hợp lệ không
    const minDays = dto.minimumBookingDays ?? 0;
    const maxDays = dto.maxAdvanceBookingDays ?? 30;
    this.validateBookingDaysConstraints(minDays, maxDays);

    const isAvailable = dto.isAvailable ?? true;

    // Kiểm tra có trùng lịch không
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

    // Kiểm tra appointmentType = IN_CLINIC thì bác sĩ phải có primaryHospitalId
    if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (!doctor?.primaryHospitalId) {
        throw new BadRequestException(
          'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
        );
      }
    }

    // Chuyển minimumBookingDays (ngày) → minimumBookingTime (phút)
    // Ví dụ: minimumBookingDays = 1 → minimumBookingTime = 24 * 60 = 1440 phút
    const minimumBookingTimeInMinutes = minDays * 24 * 60;

    const schedule = this.scheduleRepository.create({
      ...dto,
      doctorId,
      priority,
      scheduleType,
      isAvailable,
      minimumBookingTime: minimumBookingTimeInMinutes,
      maxAdvanceBookingDays: maxDays,
      discountPercent: dto.discountPercent ?? 0,
      consultationFee: dto.consultationFee?.toString() ?? null,
      effectiveFrom: effectiveFromDate,
      effectiveUntil: effectiveUntilDate,
    });

    const saved = await this.scheduleRepository.save(schedule);

    // Tạo time slots cho 7 ngày kế tiếp
    let generatedSlotsCount = 0;
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + 1); // Bắt đầu từ ngày mai

      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 7); // 7 ngày kế tiếp

      // Generate slots cho schedule này với priority handling
      generatedSlotsCount = await this.generateSlotsForSchedule(
        saved,
        startDate,
        endDate,
      );
    } catch (error) {
      console.error('Failed to auto-generate slots:', error);
      // Không throw error vì schedule đã được tạo thành công
    }

    let message = 'Tạo lịch làm việc cố định thành công';
    if (!effectiveUntilDate) {
      message += ' (lịch vô thời hạn)';
    }
    if (generatedSlotsCount > 0) {
      message += `. Đã tự động tạo ${generatedSlotsCount} time slots cho 7 ngày tới.`;
    }

    return new ResponseCommon(201, message, saved);
  }

  /**
   * Tạo nhiều lịch làm việc cố định trong một yêu cầu.
   * Lịch cố định - lặp lại theo tuần
   */
  async createManyRegular(
    doctorId: string,
    dtos: CreateDoctorScheduleDto[],
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    // Xác minh doctorId tồn tại.
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });

    if (!doctor) {
      throw new NotFoundException('Bác sĩ không tồn tại');
    }

    // Kiểm tra dtos có hợp lệ không
    if (dtos.length === 0) {
      throw new BadRequestException('Danh sách lịch làm việc không được rỗng');
    }

    // Gán giá trị mặc định cho scheduleType và priority
    const scheduleType = ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    // Thêm scheduleType và priority vào dtos
    const dtosWithPriority = dtos.map((dto) => ({
      ...dto,
      scheduleType,
      priority,
      isAvailable: dto.isAvailable ?? true,
    }));

    // Kiểm tra ngày trong tuần hợp lệ
    for (const dto of dtosWithPriority) {
      if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
        throw new BadRequestException(
          `Ngày trong tuần phải từ 0 (Chủ nhật) đến 6 (Thứ 7). Nhận được: ${dto.dayOfWeek}`,
        );
      }

      // Kiểm tra time ranges and slot duration
      this.validateTimeRange(dto);

      // Kiểm tra minimumBookingDays và maxAdvanceBookingDays có hợp lệ không
      const minDays = dto.minimumBookingDays ?? 0;
      const maxDays = dto.maxAdvanceBookingDays ?? 30;
      this.validateBookingDaysConstraints(minDays, maxDays);

      // Kiểm tra appointmentType = IN_CLINIC thì bác sĩ phải có primaryHospitalId
      if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
        if (!doctor?.primaryHospitalId) {
          throw new BadRequestException(
            'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
          );
        }
      }
    }

    // Kiểm tra overlaps với lịch cũ
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

    // Kiểm tra overlaps trong các lịch mới
    for (let i = 0; i < dtosWithPriority.length; i++) {
      for (let j = i + 1; j < dtosWithPriority.length; j++) {
        if (dtosWithPriority[i].dayOfWeek === dtosWithPriority[j].dayOfWeek) {
          // Kiểm tra time overlap
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

    // Tạo tất cả các lịch trong transaction
    const result = await this.dataSource.transaction(async (manager) => {
      const entities = dtosWithPriority.map((dto) =>
        manager.create(DoctorSchedule, {
          ...dto,
          doctorId,
          scheduleType,
          priority,
          isAvailable: dto.isAvailable ?? true,
          consultationFee: dto.consultationFee?.toString() ?? null,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          effectiveUntil: dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null,
          minimumBookingTime: dto.minimumBookingDays
            ? dto.minimumBookingDays * 24 * 60
            : 0,
          maxAdvanceBookingDays: dto.maxAdvanceBookingDays ?? 30,
        }),
      );

      return manager.save(DoctorSchedule, entities);
    });

    let totalGeneratedSlots = 0;
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + 1);

      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 7);

      const slotCounts = await Promise.all(
        result.map((schedule) =>
          this.generateSlotsForSchedule(schedule, startDate, endDate).catch(
            (err) => {
              console.error(
                `[SlotGeneration] Failed for schedule ${schedule.id}:`,
                {
                  scheduleId: schedule.id,
                  doctorId: schedule.doctorId,
                  dayOfWeek: schedule.dayOfWeek,
                  error: err instanceof Error ? err.message : String(err),
                },
              );
              return 0;
            },
          ),
        ),
      );
      totalGeneratedSlots = slotCounts.reduce((sum, count) => sum + count, 0);
    } catch (error) {
      console.error(
        '[SlotGeneration] Failed to auto-generate slots for multiple schedules:',
        {
          scheduleIds: result.map((s) => s.id),
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }

    return new ResponseCommon(
      201,
      `Tạo ${result.length} lịch làm việc thành công. Đã tự động tạo ${totalGeneratedSlots} time slots cho 7 ngày tới.`,
      result,
    );
  }

  // ========================================
  // BULK UPDATE REGULAR SCHEDULES
  // ========================================

  /**
   * Cập nhật nhiều lịch làm việc cố định (REGULAR) cùng lúc
   *
   * Flow:
   * 1. Validate tất cả schedules tồn tại và thuộc đúng doctor
   * 2. Validate tất cả là REGULAR schedules
   * 3. Cập nhật từng schedule với logic updateRegularWithSlotSync
   * 4. Trả về kết quả tổng hợp
   */
  async updateManyRegular(
    doctorId: string,
    items: { id: string; [key: string]: any }[],
  ): Promise<
    ResponseCommon<{
      updatedSchedules: DoctorSchedule[];
      totalGeneratedSlots: number;
      totalWarningAppointments: number;
      failedUpdates: { id: string; reason: string }[];
    }>
  > {
    // Kiểm tra danh sách không rỗng
    if (!items || items.length === 0) {
      throw new BadRequestException('Danh sách lịch làm việc không được rỗng');
    }

    // Xác minh doctor tồn tại
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id'],
    });

    if (!doctor) {
      throw new NotFoundException('Bác sĩ không tồn tại');
    }

    // Lấy tất cả IDs cần update
    const scheduleIds = items.map((item) => item.id);

    // Kiểm tra tất cả schedules tồn tại và thuộc doctor này
    const existingSchedules = await this.scheduleRepository.find({
      where: {
        id: In(scheduleIds),
        doctorId,
      },
    });

    // Tạo map để tra cứu nhanh
    const scheduleMap = new Map<string, DoctorSchedule>();
    for (const schedule of existingSchedules) {
      scheduleMap.set(schedule.id, schedule);
    }

    // Kiểm tra có schedule nào không tồn tại hoặc không thuộc doctor này
    const notFoundIds: string[] = [];
    const notRegularIds: string[] = [];

    for (const item of items) {
      const existing = scheduleMap.get(item.id);
      if (!existing) {
        notFoundIds.push(item.id);
      } else if (existing.scheduleType !== ScheduleType.REGULAR) {
        notRegularIds.push(item.id);
      }
    }

    if (notFoundIds.length > 0) {
      throw new NotFoundException(
        `Không tìm thấy các lịch với ID: ${notFoundIds.join(', ')}`,
      );
    }

    if (notRegularIds.length > 0) {
      throw new BadRequestException(
        `Các lịch sau không phải là lịch cố định (REGULAR): ${notRegularIds.join(', ')}`,
      );
    }

    // Cập nhật từng schedule
    const updatedSchedules: DoctorSchedule[] = [];
    const failedUpdates: { id: string; reason: string }[] = [];
    let totalGeneratedSlots = 0;
    let totalWarningAppointments = 0;

    for (const item of items) {
      const { id, ...rawData } = item;
      // Cast safely to treat as typed object for linting
      const updateData = rawData as Partial<UpdateDoctorScheduleDto>;
      const existing = scheduleMap.get(id)!;

      try {
        // Validate time range nếu có thay đổi
        if (updateData.startTime || updateData.endTime) {
          const tempDto = {
            startTime: updateData.startTime ?? existing.startTime,
            endTime: updateData.endTime ?? existing.endTime,
          };
          this.validateTimeRange(tempDto);
        }

        // Kiểm tra có thay đổi quan trọng cần sync slots không
        const hasCriticalChanges =
          (updateData.dayOfWeek !== undefined &&
            updateData.dayOfWeek !== existing.dayOfWeek) ||
          (updateData.startTime !== undefined &&
            updateData.startTime !== existing.startTime) ||
          (updateData.endTime !== undefined &&
            updateData.endTime !== existing.endTime) ||
          (updateData.slotDuration !== undefined &&
            updateData.slotDuration !== existing.slotDuration) ||
          (updateData.slotCapacity !== undefined &&
            updateData.slotCapacity !== existing.slotCapacity) ||
          (updateData.appointmentType !== undefined &&
            updateData.appointmentType !== existing.appointmentType);

        if (hasCriticalChanges) {
          // Sử dụng updateRegularWithSlotSync cho thay đổi quan trọng
          const updateDto: UpdateDoctorScheduleDto = {
            dayOfWeek: updateData.dayOfWeek,
            startTime: updateData.startTime,
            endTime: updateData.endTime,
            slotDuration: updateData.slotDuration,
            slotCapacity: updateData.slotCapacity,
            appointmentType: updateData.appointmentType,
            consultationFee: updateData.consultationFee,
            isAvailable: updateData.isAvailable,
            effectiveFrom: updateData.effectiveFrom,
            effectiveUntil: updateData.effectiveUntil,
          };

          const result = await this.updateRegularWithSlotSync(
            id,
            updateDto,
            existing,
          );
          if (result.data) {
            updatedSchedules.push(result.data);
          }

          // Parse message để lấy số liệu (đơn giản)
          const slotsMatch = result.message.match(/Đã tạo (\d+) time slots/);
          if (slotsMatch) {
            totalGeneratedSlots += parseInt(slotsMatch[1], 10);
          }
          const warningMatch = result.message.match(/CÓ (\d+) lịch hẹn/);
          if (warningMatch) {
            totalWarningAppointments += parseInt(warningMatch[1], 10);
          }
        } else {
          // Cập nhật đơn giản, không cần sync slots
          await this.scheduleRepository.update(id, {
            note: updateData.note,
            consultationFee:
              updateData.consultationFee !== undefined
                ? (updateData.consultationFee?.toString() ?? null)
                : undefined,
            isAvailable: updateData.isAvailable,
            effectiveFrom:
              updateData.effectiveFrom !== undefined
                ? updateData.effectiveFrom
                  ? new Date(updateData.effectiveFrom)
                  : null
                : undefined,
            effectiveUntil:
              updateData.effectiveUntil !== undefined
                ? updateData.effectiveUntil
                  ? new Date(updateData.effectiveUntil)
                  : null
                : undefined,
          });

          const updated = await this.scheduleRepository.findOne({
            where: { id },
          });
          if (updated) {
            updatedSchedules.push(updated);
          }
        }
      } catch (error) {
        failedUpdates.push({
          id,
          reason: error instanceof Error ? error.message : 'Lỗi không xác định',
        });
      }
    }

    // Tạo message tổng hợp
    let message = `Đã cập nhật thành công ${updatedSchedules.length}/${items.length} lịch làm việc.`;

    if (totalGeneratedSlots > 0) {
      message += ` Tổng cộng tạo ${totalGeneratedSlots} time slots mới.`;
    }

    if (totalWarningAppointments > 0) {
      message += ` ⚠️ ${totalWarningAppointments} lịch hẹn có thể bị ảnh hưởng.`;
    }

    if (failedUpdates.length > 0) {
      message += ` ${failedUpdates.length} lịch cập nhật thất bại.`;
    }

    return new ResponseCommon(200, message, {
      updatedSchedules,
      totalGeneratedSlots,
      totalWarningAppointments,
      failedUpdates,
    });
  }

  /**
   * Cập nhật lịch cố định
   */
  async updateRegular(
    id: string,
    dto: UpdateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    // Kiểm tra scheduleType
    if (existing.scheduleType !== ScheduleType.REGULAR) {
      throw new BadRequestException(
        `Lịch này không phải là lịch cố định (REGULAR). Sử dụng API phù hợp để cập nhật loại lịch ${existing.scheduleType}`,
      );
    }

    // Kiểm tra time ranges
    this.validateTimeRange(dto);

    // Kiểm tra overlap
    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    const priority = existing.priority;
    const newIsAvailable = dto.isAvailable ?? existing.isAvailable;

    // Kiểm tra effective dates
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

    // Kiểm tra appointmentType IN_CLINIC có bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)
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

    // Kiểm tra time ranges
    const timeChanged =
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.slotDuration !== undefined ||
      dto.slotCapacity !== undefined;

    // Kiểm tra time ranges thay đổi
    if (timeChanged) {
      return this.updateRegularWithSlotSync(id, dto, existing);
    }

    // Kiểm tra metadata thay đổi
    const updateData: Partial<DoctorSchedule> = {
      ...dto,
      scheduleType: undefined, // Không thể thay đổi scheduleType
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

    // Loại bỏ các trường undefined
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
   * Phương thức nội bộ để cập nhật bất kỳ loại lịch nào.
   * Được sử dụng bởi updateFlexibleSchedule và updateTimeOff.
   */
  private async updateScheduleInternal(
    id: string,
    dto: UpdateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.findById(id);
    const existing = existingResult.data!;

    // Validate khoảng thời gian
    this.validateTimeRange(dto);

    // Kiểm tra trùng lặp nếu thời gian hoặc ngày thay đổi
    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;

    const priority = existing.priority;
    const newIsAvailable = dto.isAvailable ?? existing.isAvailable;

    // Xử lý ngày hiệu lực
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

    // Loại bỏ các trường undefined
    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await this.scheduleRepository.update(id, updateData);
    const updated = await this.scheduleRepository.findOne({ where: { id } });
    return new ResponseCommon(200, 'Cập nhật lịch thành công', updated!);
  }

  /**
   * Xóa lịch làm việc cố định (REGULAR)
   *
   * Flow:
   * 1. Validate schedule tồn tại và là REGULAR
   * 2. Tìm và hủy tất cả appointments tương lai liên quan
   * 3. Xóa tất cả timeslots tương lai của schedule này
   * 4. Xóa schedule
   * 5. Gửi notification cho bệnh nhân bị hủy lịch
   */
  async deleteRegular(id: string): Promise<
    ResponseCommon<{
      cancelledAppointments: number;
      deletedSlots: number;
    }>
  > {
    const scheduleResult = await this.findById(id);
    const schedule = scheduleResult.data!;

    if (schedule.scheduleType !== ScheduleType.REGULAR) {
      throw new BadRequestException(
        `Lịch này không phải là lịch cố định (REGULAR). Sử dụng API phù hợp để xóa loại lịch ${schedule.scheduleType}`,
      );
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const result = await this.dataSource.transaction(async (manager) => {
      // ========================================
      // BƯỚC 1: TÌM VÀ HỦY TẤT CẢ APPOINTMENTS TƯƠNG LAI
      // ========================================
      const futureAppointments = await manager.find(Appointment, {
        where: {
          doctorId: schedule.doctorId,
          scheduledAt: MoreThan(now),
          status: In([
            AppointmentStatusEnum.CONFIRMED,
            AppointmentStatusEnum.PENDING_PAYMENT,
            AppointmentStatusEnum.PENDING,
          ]),
        },
        relations: [
          'patient',
          'patient.user',
          'doctor',
          'doctor.user',
          'timeSlot',
          'timeSlot.schedule',
        ],
      });

      // Lọc appointments vào đúng ngày trong tuần và khung giờ của schedule
      const [scheduleStartH, scheduleStartM] = schedule.startTime
        .split(':')
        .map(Number);
      const [scheduleEndH, scheduleEndM] = schedule.endTime
        .split(':')
        .map(Number);

      const appointmentsToCancel = futureAppointments.filter((apt) => {
        const aptDate = new Date(apt.scheduledAt);

        if (aptDate.getDay() !== schedule.dayOfWeek) return false;
        if (schedule.effectiveFrom && aptDate < schedule.effectiveFrom)
          return false;
        if (schedule.effectiveUntil && aptDate > schedule.effectiveUntil)
          return false;

        const aptTime = aptDate.getHours() * 60 + aptDate.getMinutes();
        const scheduleStartTime = scheduleStartH * 60 + scheduleStartM;
        const scheduleEndTime = scheduleEndH * 60 + scheduleEndM;

        return aptTime >= scheduleStartTime && aptTime < scheduleEndTime;
      });

      // Hủy các appointments
      for (const apt of appointmentsToCancel) {
        apt.status = AppointmentStatusEnum.CANCELLED;
        apt.cancelledAt = new Date();
        apt.cancellationReason = 'SCHEDULE_DELETED';
        apt.cancelledBy = 'DOCTOR';
        await manager.save(apt);

        await manager
          .createQueryBuilder()
          .softDelete()
          .from(TimeSlot)
          .where('id = :id', { id: apt.timeSlotId })
          .execute();
      }

      // ========================================
      // BƯỚC 2: XÓA TẤT CẢ TIMESLOTS TƯƠNG LAI
      // ========================================
      const deleteResult = await manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('scheduleId = :scheduleId', { scheduleId: id })
        .andWhere('startTime >= :now', { now })
        .andWhere('bookedCount = 0')
        .execute();

      // ========================================
      // BƯỚC 3: XÓA SCHEDULE
      // ========================================
      await manager.remove(schedule);

      return {
        cancelledAppointments: appointmentsToCancel.length,
        deletedSlots: deleteResult.affected || 0,
        appointmentsList: appointmentsToCancel,
      };
    });

    // Gửi notification cho bệnh nhân
    if (result.appointmentsList.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(result.appointmentsList, 'SCHEDULE_CHANGE')
        .catch((err) => console.error('Failed to send notifications:', err));
    }

    let message = 'Xóa lịch làm việc cố định thành công.';
    if (result.cancelledAppointments > 0) {
      message += ` Đã hủy ${result.cancelledAppointments} lịch hẹn.`;
    }
    if (result.deletedSlots > 0) {
      message += ` Đã xóa ${result.deletedSlots} time slots.`;
    }

    return new ResponseCommon(200, message, {
      cancelledAppointments: result.cancelledAppointments,
      deletedSlots: result.deletedSlots,
    });
  }

  async findAvailableByDoctor(
    doctorId: string,
    dayOfWeek?: number,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Cho phép lịch sẽ có hiệu lực trong 7 ngày tới
    const lookAheadDate = new Date();
    lookAheadDate.setDate(lookAheadDate.getDate() + 7);
    lookAheadDate.setHours(23, 59, 59, 999);

    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.doctorId = :doctorId', { doctorId })
      .andWhere('schedule.isAvailable = :isAvailable', { isAvailable: true })
      // Lọc theo ngày hiệu lực - bao gồm lịch có hiệu lực trong 7 ngày tới
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

  // ========================================
  // PHƯƠNG THỨC PHÍ KHÁM
  // ========================================

  /**
   * Lấy phí khám hiệu lực cho một lịch làm việc
   * Fallback: schedule.consultationFee → doctor.defaultConsultationFee
   * Sau đó áp dụng discountPercent nếu có
   */
  async getEffectiveConsultationFee(
    schedule: DoctorSchedule,
  ): Promise<string | null> {
    // Lấy phí gốc (phí lịch hoặc phí mặc định của bác sĩ)
    let baseFee: string | null = null;

    if (schedule.consultationFee) {
      baseFee = schedule.consultationFee;
    } else {
      // Fallback về phí mặc định của bác sĩ
      const doctor = await this.doctorRepository.findOne({
        where: { id: schedule.doctorId },
        select: ['id', 'defaultConsultationFee'],
      });
      baseFee = doctor?.defaultConsultationFee ?? null;
    }

    // Áp dụng giảm giá nếu có
    if (baseFee && schedule.discountPercent && schedule.discountPercent > 0) {
      const baseFeeNum = parseFloat(baseFee);
      const discountedFee = baseFeeNum * (1 - schedule.discountPercent / 100);
      return discountedFee.toFixed(2);
    }

    return baseFee;
  }

  /**
   * Lấy chi tiết phí khám bao gồm phí gốc, giảm giá và phí cuối cùng
   */
  async getConsultationFeeDetails(schedule: DoctorSchedule): Promise<{
    baseFee: string | null;
    discountPercent: number;
    finalFee: string | null;
  }> {
    // Lấy phí gốc (phí lịch hoặc phí mặc định của bác sĩ)
    let baseFee: string | null = null;

    if (schedule.consultationFee) {
      baseFee = schedule.consultationFee;
    } else {
      // Fallback về phí mặc định của bác sĩ
      const doctor = await this.doctorRepository.findOne({
        where: { id: schedule.doctorId },
        select: ['id', 'defaultConsultationFee'],
      });
      baseFee = doctor?.defaultConsultationFee ?? null;
    }

    const discountPercent = schedule.discountPercent ?? 0;
    let finalFee = baseFee;

    // Áp dụng giảm giá nếu có
    if (baseFee && discountPercent > 0) {
      const baseFeeNum = parseFloat(baseFee);
      const discountedFee = baseFeeNum * (1 - discountPercent / 100);
      finalFee = discountedFee.toFixed(2);
    }

    return {
      baseFee,
      discountPercent,
      finalFee,
    };
  }

  /**
   * Bổ sung thông tin phí và ngày đặt tối thiểu cho lịch làm việc
   */
  async enrichScheduleWithEffectiveFee(schedule: DoctorSchedule): Promise<
    DoctorSchedule & {
      effectiveConsultationFee: string | null;
      finalFee: string | null;
      savedAmount: string | null;
      minimumBookingDays: number;
    }
  > {
    // const baseFee = await this.getEffectiveConsultationFee(schedule);

    let finalFee: string | null = null;
    let savedAmount: string | null = null;

    // Lấy phí gốc thực tế trước giảm giá (từ logic getConsultationFeeDetails)
    let originalBaseFee: string | null = null;
    if (schedule.consultationFee) {
      originalBaseFee = schedule.consultationFee;
    } else {
      const doctor = await this.doctorRepository.findOne({
        where: { id: schedule.doctorId },
        select: ['id', 'defaultConsultationFee'],
      });
      originalBaseFee = doctor?.defaultConsultationFee ?? null;
    }

    const discountPercent = schedule.discountPercent ?? 0;

    if (originalBaseFee && discountPercent > 0) {
      const baseAmount = parseFloat(originalBaseFee);
      const discount = baseAmount * (discountPercent / 100);
      finalFee = (baseAmount - discount).toFixed(0); // Round VND
      savedAmount = discount.toFixed(0);
    } else {
      finalFee = originalBaseFee; // No discount = original fee
    }

    // Chuyển đổi minimumBookingTime (phút) → minimumBookingDays (ngày)
    const minimumBookingDays = Math.ceil(
      schedule.minimumBookingTime / (24 * 60),
    );

    return {
      ...schedule,
      effectiveConsultationFee: originalBaseFee, // Phí gốc trước giảm giá
      finalFee, // Phí sau giảm giá
      savedAmount, // Số tiền tiết kiệm
      minimumBookingDays, // Đã chuyển đổi cho frontend
    };
  }

  /**
   * Bổ sung thông tin phí và ngày đặt tối thiểu cho nhiều lịch làm việc
   */
  async enrichSchedulesWithEffectiveFee(schedules: DoctorSchedule[]): Promise<
    (DoctorSchedule & {
      effectiveConsultationFee: string | null;
      finalFee: string | null;
      savedAmount: string | null;
      minimumBookingDays: number;
    })[]
  > {
    if (schedules.length === 0) return [];

    // Lấy danh sách doctorIds duy nhất
    const doctorIds = [...new Set(schedules.map((s) => s.doctorId))];

    // Batch fetch các bác sĩ
    const doctors = await this.doctorRepository
      .createQueryBuilder('doctor')
      .select(['doctor.id', 'doctor.defaultConsultationFee'])
      .whereInIds(doctorIds)
      .getMany();

    const doctorFeeMap = new Map(
      doctors.map((d) => [d.id, d.defaultConsultationFee]),
    );

    return schedules.map((schedule) => {
      // Lấy phí gốc (phí lịch hoặc phí mặc định của bác sĩ)
      const baseFee =
        schedule.consultationFee ?? doctorFeeMap.get(schedule.doctorId) ?? null;
      const discountPercent = schedule.discountPercent ?? 0;

      let finalFee: string | null = null;
      let savedAmount: string | null = null;

      if (baseFee && discountPercent > 0) {
        const baseAmount = parseFloat(baseFee);
        const discount = baseAmount * (discountPercent / 100);
        finalFee = (baseAmount - discount).toFixed(0);
        savedAmount = discount.toFixed(0);
      } else {
        finalFee = baseFee;
      }

      // Chuyển đổi minimumBookingTime (phút) → minimumBookingDays (ngày)
      const minimumBookingDays = Math.ceil(
        schedule.minimumBookingTime / (24 * 60),
      );

      return {
        ...schedule,
        effectiveConsultationFee: baseFee,
        finalFee,
        savedAmount,
        minimumBookingDays,
      };
    });
  }

  // ========================================
  // PHƯƠNG THỨC LỊCH LINH HOẠT
  // ========================================

  async createFlexibleSchedule(
    doctorId: string,
    dto: CreateFlexibleScheduleDto,
  ): Promise<
    ResponseCommon<
      DoctorSchedule & {
        cancelledAppointments: number;
        generatedSlots: number;
      }
    >
  > {
    const specificDate = new Date(dto.specificDate);
    const dayOfWeek = specificDate.getDay();
    const priority = SCHEDULE_TYPE_PRIORITY[ScheduleType.FLEXIBLE];

    // Validate thời gian
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    // Validate ngày không phải là quá khứ
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (specificDate < today) {
      throw new BadRequestException(
        'Không thể tạo lịch cho ngày trong quá khứ',
      );
    }

    // Validate bác sĩ tồn tại
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });
    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ với ID ${doctorId}`);
    }

    // Validate IN_CLINIC yêu cầu doctor.primaryHospitalId
    if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (!doctor.primaryHospitalId) {
        throw new BadRequestException(
          'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
        );
      }
    }

    // Kiểm tra trùng lặp với lịch hiện có cho ngày cụ thể này
    await this.checkOverlap(
      doctorId,
      dayOfWeek,
      dto.startTime,
      dto.endTime,
      specificDate,
      specificDate,
      priority,
    );

    // Parse chuỗi thời gian để tạo slot
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    // Gói tất cả operations trong một transaction để đảm bảo atomicity
    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Tìm và hủy các cuộc hẹn xung đột
      const startOfDay = new Date(specificDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(specificDate);
      endOfDay.setHours(23, 59, 59, 999);

      const appointments = await manager.find(Appointment, {
        where: {
          doctorId,
          scheduledAt: Between(startOfDay, endOfDay),
          status: In([
            AppointmentStatusEnum.CONFIRMED,
            AppointmentStatusEnum.PENDING_PAYMENT,
          ]),
        },
        relations: [
          'patient',
          'patient.user',
          'doctor',
          'doctor.user',
          'timeSlot',
          'timeSlot.schedule',
        ],
      });

      const conflicting = appointments.filter((apt) => {
        if (!apt.timeSlot?.schedule?.slotDuration) return false;
        const aptEnd = new Date(
          apt.scheduledAt.getTime() +
            apt.timeSlot.schedule.slotDuration * 60 * 1000,
        );
        return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
      });

      // Hủy từng cuộc hẹn xung đột
      for (const apt of conflicting) {
        apt.status = AppointmentStatusEnum.CANCELLED;
        apt.cancelledAt = new Date();
        apt.cancellationReason = 'SCHEDULE_CHANGE';
        apt.cancelledBy = 'SYSTEM';
        await manager.save(apt);

        // Giải phóng time slot nếu tồn tại
        if (apt.timeSlotId) {
          await manager
            .createQueryBuilder()
            .softDelete()
            .from(TimeSlot)
            .where('id = :id', { id: apt.timeSlotId })
            .execute();
        }
      }

      // SỬA: Xóa TẤT CẢ slots chưa book trong khung giờ thay vì chỉ disable
      await manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('doctorId = :doctorId', { doctorId })
        .andWhere('startTime >= :scheduleStart', { scheduleStart })
        .andWhere('endTime <= :scheduleEnd', { scheduleEnd })
        .andWhere('bookedCount = 0')
        .execute();

      // 3. Tạo lịch làm việc
      const schedule = manager.create(DoctorSchedule, {
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

      const savedSchedule = await manager.save(schedule);

      // SỬA: Kiểm tra các slots còn lại trước khi tạo mới
      const existingSlots = await manager.find(TimeSlot, {
        where: {
          doctorId,
          startTime: Between(scheduleStart, scheduleEnd),
        },
      });

      // 4. Tạo time slots cho lịch này (tránh trùng lặp)
      const slotDurationMs = dto.slotDuration * 60 * 1000;
      let currentStart = new Date(scheduleStart);
      const slotEntities: TimeSlot[] = [];

      while (currentStart < scheduleEnd) {
        const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
        if (slotEnd > scheduleEnd) break;

        // SỬA: Kiểm tra không trùng lặp với slots hiện có
        const hasOverlap = existingSlots.some(
          (existingSlot) =>
            currentStart < existingSlot.endTime &&
            slotEnd > existingSlot.startTime,
        );

        if (!hasOverlap) {
          const slot = manager.create(TimeSlot, {
            doctorId: savedSchedule.doctorId,
            scheduleId: savedSchedule.id,
            startTime: new Date(currentStart),
            endTime: new Date(slotEnd),
            capacity: dto.slotCapacity,
            allowedAppointmentTypes: [dto.appointmentType],
            isAvailable: true,
            bookedCount: 0,
          });

          slotEntities.push(slot);
        }

        currentStart = slotEnd;
      }

      if (slotEntities.length > 0) {
        await manager.save(TimeSlot, slotEntities);
      }

      return {
        schedule: savedSchedule,
        cancelledAppointments: conflicting,
        generatedSlotsCount: slotEntities.length,
      };
    });

    // Gửi thông báo sau khi transaction thành công
    this.sendFlexibleScheduleNotifications(result.cancelledAppointments);

    const message =
      result.cancelledAppointments.length > 0
        ? `Tạo lịch làm việc linh hoạt thành công. ${result.cancelledAppointments.length} lịch hẹn đã được hủy. Đã tạo ${result.generatedSlotsCount} time slots.`
        : `Tạo lịch làm việc linh hoạt thành công. Đã tạo ${result.generatedSlotsCount} time slots.`;

    return new ResponseCommon(201, message, {
      ...result.schedule,
      cancelledAppointments: result.cancelledAppointments.length,
      generatedSlots: result.generatedSlotsCount,
    });
  }

  /**
   * Gửi thông báo sau khi tạo lịch linh hoạt (gọi sau transaction)
   */
  private sendFlexibleScheduleNotifications(
    cancelledAppointments: Appointment[],
  ): void {
    if (cancelledAppointments.length > 0) {
      // Chạy nền, không block response
      this.notificationService
        .notifyCancelledAppointments(cancelledAppointments, 'SCHEDULE_CHANGE')
        .catch((err) => {
          console.error('Failed to send notifications:', err);
        });
    }
  }

  /**
   * Cập nhật lịch làm việc linh hoạt
   * Nếu thời gian thay đổi, đồng bộ lại time slots (hủy appointments, xóa slots cũ, tạo mới)
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

    // Kiểm tra thời gian có thay đổi không
    const timeChanged =
      (dto.startTime && dto.startTime !== existing.startTime) ||
      (dto.endTime && dto.endTime !== existing.endTime);

    if (timeChanged) {
      return this.updateFlexibleScheduleWithSlotSync(id, dto, existing);
    }

    // Nếu chỉ metadata thay đổi (phí, capacity...), cập nhật trực tiếp
    const updateDto: UpdateDoctorScheduleDto = {
      slotCapacity: dto.slotCapacity,
      slotDuration: dto.slotDuration,
      appointmentType: dto.appointmentType,
      consultationFee: dto.consultationFee,
      isAvailable: dto.isAvailable,
    };

    return this.updateScheduleInternal(id, updateDto);
  }

  /**
   * Cập nhật lịch FLEXIBLE khi khung giờ thay đổi
   * FLEXIBLE đè hoàn toàn REGULAR trong ngày đó
   */
  private async updateFlexibleScheduleWithSlotSync(
    id: string,
    dto: UpdateFlexibleScheduleDto,
    existing: DoctorSchedule,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    if (!existing.specificDate) {
      throw new BadRequestException('Lịch linh hoạt phải có specificDate');
    }

    const specificDate = new Date(existing.specificDate);
    // const dayOfWeek = specificDate.getDay();

    // Khung giờ CŨ
    const [oldStartH, oldStartM] = existing.startTime.split(':').map(Number);
    const [oldEndH, oldEndM] = existing.endTime.split(':').map(Number);

    const oldScheduleStart = new Date(specificDate);
    oldScheduleStart.setHours(oldStartH, oldStartM, 0, 0);

    const oldScheduleEnd = new Date(specificDate);
    oldScheduleEnd.setHours(oldEndH, oldEndM, 0, 0);

    // Khung giờ MỚI
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;

    if (newStartTime >= newEndTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const [startH, startM] = newStartTime.split(':').map(Number);
    const [endH, endM] = newEndTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Xóa slots cũ từ lịch FLEXIBLE này trong khung giờ CŨ
      await manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('scheduleId = :scheduleId', { scheduleId: id })
        .andWhere('bookedCount = 0')
        .execute();

      // 2. Hủy các cuộc hẹn xung đột trong khung giờ MỚI
      const startOfDay = new Date(specificDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(specificDate);
      endOfDay.setHours(23, 59, 59, 999);

      const appointments = await manager.find(Appointment, {
        where: {
          doctorId: existing.doctorId,
          scheduledAt: Between(startOfDay, endOfDay),
          status: In([
            AppointmentStatusEnum.CONFIRMED,
            AppointmentStatusEnum.PENDING_PAYMENT,
            AppointmentStatusEnum.PENDING,
          ]),
        },
        relations: [
          'patient',
          'patient.user',
          'doctor',
          'doctor.user',
          'timeSlot',
          'timeSlot.schedule',
        ],
      });

      const conflicting = appointments.filter((apt) => {
        const aptEnd = new Date(
          apt.scheduledAt.getTime() +
            apt.timeSlot.schedule.slotDuration * 60 * 1000,
        );
        return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
      });

      for (const apt of conflicting) {
        apt.status = AppointmentStatusEnum.CANCELLED;
        apt.cancelledAt = new Date();
        apt.cancellationReason = 'SCHEDULE_CHANGE';
        apt.cancelledBy = 'SYSTEM';
        await manager.save(apt);

        if (apt.timeSlotId) {
          await manager
            .createQueryBuilder()
            .softDelete()
            .from(TimeSlot)
            .where('id = :id', { id: apt.timeSlotId })
            .execute();
        }
      }

      // 3. Xóa các slots chưa book khác trong khung giờ MỚI (chuẩn bị cho slots mới)
      await manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('doctorId = :doctorId', { doctorId: existing.doctorId })
        .andWhere('startTime >= :scheduleStart', { scheduleStart })
        .andWhere('endTime <= :scheduleEnd', { scheduleEnd })
        .andWhere('bookedCount = 0')
        .execute();

      // 4. Cập nhật schedule
      const slotCapacity = dto.slotCapacity ?? existing.slotCapacity;
      const slotDuration = dto.slotDuration ?? existing.slotDuration;
      const appointmentType = dto.appointmentType ?? existing.appointmentType;

      await manager.update(DoctorSchedule, id, {
        startTime: newStartTime,
        endTime: newEndTime,
        slotCapacity,
        slotDuration,
        appointmentType,
        consultationFee:
          dto.consultationFee !== undefined
            ? (dto.consultationFee?.toString() ?? null)
            : existing.consultationFee,
        isAvailable: dto.isAvailable ?? existing.isAvailable,
      });

      // 5. Kiểm tra các slots còn lại trước khi tạo mới
      const existingSlots = await manager.find(TimeSlot, {
        where: {
          doctorId: existing.doctorId,
          startTime: Between(scheduleStart, scheduleEnd),
        },
      });

      // 6. Tạo time slots mới cho khung giờ MỚI
      const slotDurationMs = slotDuration * 60 * 1000;
      let currentStart = new Date(scheduleStart);
      const slotEntities: TimeSlot[] = [];

      while (currentStart < scheduleEnd) {
        const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
        if (slotEnd > scheduleEnd) break;

        const hasOverlap = existingSlots.some(
          (existingSlot) =>
            currentStart < existingSlot.endTime &&
            slotEnd > existingSlot.startTime,
        );

        if (!hasOverlap) {
          const slot = manager.create(TimeSlot, {
            doctorId: existing.doctorId,
            scheduleId: id,
            startTime: new Date(currentStart),
            endTime: new Date(slotEnd),
            capacity: slotCapacity,
            allowedAppointmentTypes: [appointmentType],
            isAvailable: true,
            bookedCount: 0,
          });
          slotEntities.push(slot);
        }

        currentStart = slotEnd;
      }

      if (slotEntities.length > 0) {
        await manager.save(TimeSlot, slotEntities);
      }

      // Gửi thông báo
      if (conflicting.length > 0) {
        this.notificationService
          .notifyCancelledAppointments(conflicting, 'SCHEDULE_CHANGE')
          .catch((err) => {
            console.error('Failed to send notifications:', err);
          });
      }

      const updated = await manager.findOne(DoctorSchedule, { where: { id } });

      return {
        schedule: updated!,
        cancelledCount: conflicting.length,
        generatedSlots: slotEntities.length,
      };
    });

    let message = `Cập nhật lịch thành công.`;
    if (result.cancelledCount > 0) {
      message += ` ${result.cancelledCount} lịch hẹn đã bị hủy.`;
    }
    message += ` Đã tạo ${result.generatedSlots} time slots mới.`;

    return new ResponseCommon(200, message, result.schedule);
  }

  /**
   * Xóa lịch làm việc linh hoạt (FLEXIBLE)
   *
   * Flow:
   * 1. Validate schedule tồn tại và là FLEXIBLE
   * 2. Tìm và hủy tất cả appointments trong ngày đó (trong khung giờ của schedule)
   * 3. Xóa tất cả timeslots của schedule này
   * 4. Xóa schedule
   * 5. Restore slots từ REGULAR schedules
   * 6. Gửi notification cho bệnh nhân bị hủy lịch
   */
  async deleteFlexibleSchedule(id: string): Promise<
    ResponseCommon<{
      cancelledAppointments: number;
      deletedSlots: number;
      restoredSlots: number;
    }>
  > {
    const existingResult = await this.findById(id);
    const schedule = existingResult.data!;

    if (schedule.scheduleType !== ScheduleType.FLEXIBLE) {
      throw new BadRequestException(
        `Lịch này không phải là lịch linh hoạt (FLEXIBLE). Sử dụng API phù hợp để xóa loại lịch ${schedule.scheduleType}`,
      );
    }

    if (!schedule.specificDate) {
      throw new BadRequestException('Lịch linh hoạt phải có specificDate');
    }

    const specificDate = new Date(schedule.specificDate);
    const dayOfWeek = specificDate.getDay();

    // Parse khung giờ
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    const result = await this.dataSource.transaction(async (manager) => {
      // ========================================
      // BƯỚC 1: TÌM VÀ HỦY APPOINTMENTS TRONG NGÀY
      // ========================================
      const dayStart = new Date(specificDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(specificDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dayAppointments = await manager.find(Appointment, {
        where: {
          doctorId: schedule.doctorId,
          scheduledAt: Between(dayStart, dayEnd),
          status: In([
            AppointmentStatusEnum.CONFIRMED,
            AppointmentStatusEnum.PENDING_PAYMENT,
            AppointmentStatusEnum.PENDING,
          ]),
        },
        relations: [
          'patient',
          'patient.user',
          'doctor',
          'doctor.user',
          'timeSlot',
          'timeSlot.schedule',
        ],
      });

      // Lọc appointments trong khung giờ của schedule
      const appointmentsToCancel = dayAppointments.filter((apt) => {
        const aptTime = new Date(apt.scheduledAt);
        const aptEnd = new Date(
          aptTime.getTime() + apt.timeSlot.schedule.slotDuration * 60 * 1000,
        );
        return aptTime >= scheduleStart && aptEnd <= scheduleEnd;
      });

      // Hủy các appointments
      for (const apt of appointmentsToCancel) {
        apt.status = AppointmentStatusEnum.CANCELLED;
        apt.cancelledAt = new Date();
        apt.cancellationReason = 'SCHEDULE_DELETED';
        apt.cancelledBy = 'DOCTOR';
        await manager.save(apt);

        await manager
          .createQueryBuilder()
          .softDelete()
          .from(TimeSlot)
          .where('id = :id', { id: apt.timeSlotId })
          .execute();
      }

      // ========================================
      // BƯỚC 2: XÓA TIME SLOTS CỦA SCHEDULE NÀY
      // ========================================
      const deleteResult = await manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('scheduleId = :scheduleId', { scheduleId: id })
        .andWhere('bookedCount = 0')
        .execute();

      // ========================================
      // BƯỚC 3: XÓA SCHEDULE
      // ========================================
      await manager.remove(schedule);

      // ========================================
      // BƯỚC 4: RESTORE SLOTS TỪ REGULAR SCHEDULES
      // ========================================
      const restoredSlots = await this.restoreSlotsFromRegularSchedules(
        manager,
        schedule.doctorId,
        dayOfWeek,
        specificDate,
        scheduleStart,
        scheduleEnd,
      );

      return {
        cancelledAppointments: appointmentsToCancel.length,
        deletedSlots: deleteResult.affected || 0,
        restoredSlots,
        appointmentsList: appointmentsToCancel,
      };
    });

    // Gửi notification cho bệnh nhân
    if (result.appointmentsList.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(result.appointmentsList, 'SCHEDULE_CHANGE')
        .catch((err) => console.error('Failed to send notifications:', err));
    }

    let message = 'Xóa lịch linh hoạt thành công.';
    if (result.cancelledAppointments > 0) {
      message += ` Đã hủy ${result.cancelledAppointments} lịch hẹn.`;
    }
    if (result.deletedSlots > 0) {
      message += ` Đã xóa ${result.deletedSlots} time slots.`;
    }
    if (result.restoredSlots > 0) {
      message += ` Đã khôi phục ${result.restoredSlots} time slots từ lịch cố định.`;
    }

    return new ResponseCommon(200, message, {
      cancelledAppointments: result.cancelledAppointments,
      deletedSlots: result.deletedSlots,
      restoredSlots: result.restoredSlots,
    });
  }

  /**
   * Tạo lịch nghỉ cho một ngày cụ thể
   * Lịch nghỉ - khách hàng không thể đặt lịch khám hoặc tư vấn
   *
   * Phương thức này gói tất cả operations trong transaction để đảm bảo atomicity:
   * 1. Hủy các cuộc hẹn xung đột
   * 2. Tắt các time slots trùng lặp
   * 3. Tạo lịch TIME_OFF
   */
  async createTimeOff(
    doctorId: string,
    dto: CreateTimeOffDto,
  ): Promise<
    ResponseCommon<
      DoctorSchedule & {
        cancelledAppointments: number;
        disabledSlots: number;
      }
    >
  > {
    const specificDate = new Date(dto.specificDate);
    const dayOfWeek = specificDate.getDay();
    const priority = SCHEDULE_TYPE_PRIORITY[ScheduleType.TIME_OFF];

    // Validate thời gian
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    // Validate ngày không phải là quá khứ
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const specificDateNormalized = new Date(specificDate);
    specificDateNormalized.setHours(0, 0, 0, 0);
    if (specificDateNormalized.getTime() < today.getTime()) {
      throw new BadRequestException(
        'Không thể tạo lịch nghỉ cho ngày trong quá khứ',
      );
    }

    // Validate bác sĩ tồn tại
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id'],
    });
    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ với ID ${doctorId}`);
    }

    // Kiểm tra trùng lặp với lịch hiện có
    await this.checkOverlap(
      doctorId,
      dayOfWeek,
      dto.startTime,
      dto.endTime,
      specificDate,
      specificDate,
      priority,
    );

    // Parse chuỗi thời gian
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    // Gói tất cả operations trong một transaction để đảm bảo atomicity
    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Tìm và hủy các cuộc hẹn xung đột
      const startOfDay = new Date(specificDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(specificDate);
      endOfDay.setHours(23, 59, 59, 999);

      const appointments = await manager.find(Appointment, {
        where: {
          doctorId,
          scheduledAt: Between(startOfDay, endOfDay),
          status: In([
            AppointmentStatusEnum.CONFIRMED,
            AppointmentStatusEnum.PENDING_PAYMENT,
          ]),
        },
        relations: [
          'patient',
          'patient.user',
          'doctor',
          'doctor.user',
          'timeSlot',
          'timeSlot.schedule',
        ],
      });

      const conflicting = appointments.filter((apt) => {
        const aptEnd = new Date(
          apt.scheduledAt.getTime() +
            apt.timeSlot.schedule.slotDuration * 60 * 1000,
        );
        return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
      });

      // Hủy từng cuộc hẹn xung đột
      for (const apt of conflicting) {
        apt.status = AppointmentStatusEnum.CANCELLED;
        apt.cancelledAt = new Date();
        apt.cancellationReason = 'TIME_OFF';
        apt.cancelledBy = 'SYSTEM';
        await manager.save(apt);

        // Giải phóng time slot nếu tồn tại
        if (apt.timeSlotId) {
          await manager
            .createQueryBuilder()
            .update(TimeSlot)
            .set({ bookedCount: () => 'GREATEST(booked_count - 1, 0)' })
            .where('id = :id', { id: apt.timeSlotId })
            .execute();
        }
      }

      // 2. Tắt các time slots trùng lặp mà chưa có booking
      const disableResult = await manager
        .createQueryBuilder()
        .update(TimeSlot)
        .set({ isAvailable: false })
        .where('doctorId = :doctorId', { doctorId })
        .andWhere('startTime >= :scheduleStart', { scheduleStart })
        .andWhere('endTime <= :scheduleEnd', { scheduleEnd })
        .andWhere('bookedCount = 0')
        .execute();

      // 3. Tạo lịch TIME_OFF
      const schedule = manager.create(DoctorSchedule, {
        doctorId,
        scheduleType: ScheduleType.TIME_OFF,
        priority,
        dayOfWeek,
        specificDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        // TIME_OFF không cần cài đặt slot, sử dụng giá trị mặc định
        slotCapacity: 1,
        slotDuration: 30,
        appointmentType: AppointmentTypeEnum.VIDEO, // Không quan trọng với TIME_OFF
        isAvailable: false, // TIME_OFF luôn không khả dụng
        note: dto.note ?? null,
        effectiveFrom: specificDate,
        effectiveUntil: specificDate,
      });

      const savedSchedule = await manager.save(schedule);

      return {
        schedule: savedSchedule,
        cancelledAppointments: conflicting,
        disabledSlotsCount: disableResult.affected || 0,
      };
    });

    // Gửi thông báo sau khi transaction thành công
    if (result.cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(result.cancelledAppointments, 'TIME_OFF')
        .catch((err) => console.error('Failed to send notifications:', err));
    }

    const message =
      result.cancelledAppointments.length > 0
        ? `Tạo lịch nghỉ thành công. ${result.cancelledAppointments.length} lịch hẹn đã được hủy. ${result.disabledSlotsCount} time slots đã được tắt.`
        : `Tạo lịch nghỉ thành công. ${result.disabledSlotsCount} time slots đã được tắt.`;

    return new ResponseCommon(201, message, {
      ...result.schedule,
      cancelledAppointments: result.cancelledAppointments.length,
      disabledSlots: result.disabledSlotsCount,
    });
  }

  /**
   * Cập nhật lịch nghỉ
   * Nếu thời gian thay đổi, hủy lại appointments và tắt slots trong khung giờ mới
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

    const timeChanged =
      (dto.startTime && dto.startTime !== existing.startTime) ||
      (dto.endTime && dto.endTime !== existing.endTime);
    if (timeChanged) {
      return this.updateTimeOffWithSlotSync(id, dto, existing);
    }

    // Chỉ cập nhật note/isAvailable
    const updateDto: UpdateDoctorScheduleDto = {
      note: dto.note,
      isAvailable: dto.isAvailable,
    };

    return this.updateScheduleInternal(id, updateDto);
  }

  /**
   * Cập nhật lịch TIME_OFF với khôi phục slot đúng cách
   * Khi khung giờ thu hẹp, khôi phục slots từ lịch REGULAR
   */
  private async updateTimeOffWithSlotSync(
    id: string,
    dto: UpdateTimeOffDto,
    existing: DoctorSchedule,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    if (!existing.specificDate) {
      throw new BadRequestException('Lịch nghỉ phải có specificDate');
    }

    const specificDate = new Date(existing.specificDate);
    const dayOfWeek = specificDate.getDay();

    const [oldStartH, oldStartM] = existing.startTime.split(':').map(Number);
    const [oldEndH, oldEndM] = existing.endTime.split(':').map(Number);

    const oldScheduleStart = new Date(specificDate);
    oldScheduleStart.setHours(oldStartH, oldStartM, 0, 0);

    const oldScheduleEnd = new Date(specificDate);
    oldScheduleEnd.setHours(oldEndH, oldEndM, 0, 0);

    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    if (newStartTime >= newEndTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const [startH, startM] = newStartTime.split(':').map(Number);
    const [endH, endM] = newEndTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Hủy các cuộc hẹn xung đột trong khung giờ MỚI
      const startOfDay = new Date(specificDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(specificDate);
      endOfDay.setHours(23, 59, 59, 999);

      const appointments = await manager.find(Appointment, {
        where: {
          doctorId: existing.doctorId,
          scheduledAt: Between(startOfDay, endOfDay),
          status: In([
            AppointmentStatusEnum.CONFIRMED,
            AppointmentStatusEnum.PENDING_PAYMENT,
          ]),
        },
        relations: [
          'patient',
          'patient.user',
          'doctor',
          'doctor.user',
          'timeSlot',
          'timeSlot.schedule',
        ],
      });

      // Helper để hủy appointments trong một khoảng thời gian
      const cancelAppointmentsInRange = async (
        rangeStart: Date,
        rangeEnd: Date,
      ): Promise<Appointment[]> => {
        const conflicting = appointments.filter((apt) => {
          // Kiểm tra null/undefined cho timeSlot và schedule
          if (!apt.timeSlot?.schedule?.slotDuration) return false;
          const aptEnd = new Date(
            apt.scheduledAt.getTime() +
              apt.timeSlot.schedule.slotDuration * 60 * 1000,
          );
          return apt.scheduledAt < rangeEnd && aptEnd > rangeStart;
        });

        for (const apt of conflicting) {
          apt.status = AppointmentStatusEnum.CANCELLED;
          apt.cancelledAt = new Date();
          apt.cancellationReason = 'TIME_OFF';
          apt.cancelledBy = 'SYSTEM';
          await manager.save(apt);

          if (apt.timeSlotId) {
            await manager
              .createQueryBuilder()
              .update(TimeSlot)
              .set({ bookedCount: () => 'GREATEST(booked_count - 1, 0)' })
              .where('id = :id', { id: apt.timeSlotId })
              .execute();
          }
        }

        return conflicting;
      };

      const cancelledIds = new Set<string>();

      // Hủy appointments trong khung giờ MỚI (phần overlap với khung cũ)
      const conflicting = await cancelAppointmentsInRange(
        scheduleStart,
        scheduleEnd,
      );
      const allCancelledAppointments: Appointment[] = [];

      for (const apt of conflicting) {
        if (!cancelledIds.has(apt.id)) {
          cancelledIds.add(apt.id);
          allCancelledAppointments.push(apt);
        }
      }

      // 2. Tính toán các khoảng cần DISABLE (phần MỞ RỘNG)
      const rangesToDisable: Array<{ start: Date; end: Date }> = [];

      // Case 3: Giờ bắt đầu dịch về trước (10:00 -> 09:00)
      // Cần disable: [newStart, oldStart)
      if (scheduleStart < oldScheduleStart) {
        rangesToDisable.push({
          start: scheduleStart,
          end: oldScheduleStart,
        });
      }

      // Case 4: Giờ kết thúc dịch về sau (11:00 -> 12:00)
      // Cần disable: [oldEnd, newEnd)
      if (scheduleEnd > oldScheduleEnd) {
        rangesToDisable.push({
          start: oldScheduleEnd,
          end: scheduleEnd,
        });
      }

      // Hủy appointments VÀ disable slots trong các khoảng MỞ RỘNG
      let disabledSlots = 0;
      for (const range of rangesToDisable) {
        // Hủy appointments trong khoảng mở rộng
        const cancelledInRange = await cancelAppointmentsInRange(
          range.start,
          range.end,
        );

        for (const apt of cancelledInRange) {
          if (!cancelledIds.has(apt.id)) {
            cancelledIds.add(apt.id);
            allCancelledAppointments.push(apt);
          }
        }

        // Disable slots trong khoảng mở rộng
        const disableResult = await manager
          .createQueryBuilder()
          .update(TimeSlot)
          .set({ isAvailable: false })
          .where('doctorId = :doctorId', { doctorId: existing.doctorId })
          .andWhere('startTime >= :rangeStart', { rangeStart: range.start })
          .andWhere('endTime <= :rangeEnd', { rangeEnd: range.end })
          .andWhere('bookedCount = 0')
          .execute();
        disabledSlots += disableResult.affected || 0;
      }

      // 3. Tính toán các khoảng cần RESTORE (phần THU HẸP)
      let restoredSlots = 0;
      const rangesToRestore: Array<{ start: Date; end: Date }> = [];

      // Case 1: Giờ bắt đầu dịch về sau (09:00 -> 10:00)
      // Khôi phục: [oldStart, newStart)
      if (scheduleStart > oldScheduleStart) {
        rangesToRestore.push({
          start: oldScheduleStart,
          end: scheduleStart,
        });
      }

      // Case 2: Giờ kết thúc dịch về trước (12:00 -> 11:00)
      // Khôi phục: [newEnd, oldEnd)
      if (scheduleEnd < oldScheduleEnd) {
        rangesToRestore.push({
          start: scheduleEnd,
          end: oldScheduleEnd,
        });
      }

      // Khôi phục slots từ lịch REGULAR cho từng khoảng thu hẹp
      for (const range of rangesToRestore) {
        const restored = await this.restoreSlotsFromRegularSchedules(
          manager,
          existing.doctorId,
          dayOfWeek,
          specificDate,
          range.start,
          range.end,
        );
        restoredSlots += restored;
      }

      // 4. Cập nhật schedule
      await manager.update(DoctorSchedule, id, {
        startTime: newStartTime,
        endTime: newEndTime,
        note: dto.note ?? existing.note,
        isAvailable: dto.isAvailable ?? existing.isAvailable,
      });

      const updated = await manager.findOne(DoctorSchedule, { where: { id } });

      return {
        schedule: updated!,
        cancelledAppointments: allCancelledAppointments,
        disabledSlots,
        restoredSlots,
      };
    });

    // Gửi notification cho bệnh nhân bị hủy lịch
    if (result.cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(result.cancelledAppointments, 'TIME_OFF')
        .catch((err) => console.error('Failed to send notifications:', err));
    }

    let message = `Cập nhật lịch nghỉ thành công.`;
    if (result.cancelledAppointments.length > 0) {
      message += ` ${result.cancelledAppointments.length} lịch hẹn đã bị hủy.`;
    }
    if (result.disabledSlots > 0) {
      message += ` ${result.disabledSlots} time slots đã được tắt.`;
    }
    if (result.restoredSlots > 0) {
      message += ` ${result.restoredSlots} time slots đã được khôi phục.`;
    }

    return new ResponseCommon(200, message, result.schedule);
  }

  /**
   * ĐÃ REFACTOR: Xóa TIME_OFF sử dụng helper khôi phục chung
   */
  async deleteTimeOff(id: string): Promise<
    ResponseCommon<{
      restoredSlots: number;
    }>
  > {
    const existingResult = await this.findById(id);
    const schedule = existingResult.data!;

    if (schedule.scheduleType !== ScheduleType.TIME_OFF) {
      throw new BadRequestException(
        `Lịch này không phải là lịch nghỉ (TIME_OFF). Sử dụng API phù hợp để xóa loại lịch ${schedule.scheduleType}`,
      );
    }

    if (!schedule.specificDate) {
      throw new BadRequestException('Lịch nghỉ phải có specificDate');
    }

    const specificDate = new Date(schedule.specificDate);
    const dayOfWeek = specificDate.getDay();

    // Parse khung giờ
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    const result = await this.dataSource.transaction(async (manager) => {
      // 1. Xóa schedule trước
      await manager.remove(schedule);

      // 2. Sử dụng helper khôi phục chung để khôi phục TOÀN BỘ khung giờ
      const restoredSlots = await this.restoreSlotsFromRegularSchedules(
        manager,
        schedule.doctorId,
        dayOfWeek,
        specificDate,
        scheduleStart,
        scheduleEnd,
      );

      return { restoredSlots };
    });

    const message =
      result.restoredSlots > 0
        ? `Xóa lịch nghỉ thành công. Đã khôi phục ${result.restoredSlots} time slots.`
        : `Xóa lịch nghỉ thành công.`;

    return new ResponseCommon(200, message, result);
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

    // Parse chuỗi thời gian
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    // Tìm các cuộc hẹn trùng với khung giờ
    // Bao gồm cả CONFIRMED và PENDING_PAYMENT
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

    // Lọc chỉ những cuộc hẹn trùng với khung giờ
    const conflicting = appointments.filter((apt) => {
      const aptEnd = new Date(
        apt.scheduledAt.getTime() +
          apt.timeSlot.schedule.slotDuration * 60 * 1000,
      );
      return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
    });

    if (conflicting.length === 0) {
      return 0;
    }

    // Hủy từng cuộc hẹn xung đột
    await this.dataSource.transaction(async (manager) => {
      for (const apt of conflicting) {
        apt.status = AppointmentStatusEnum.CANCELLED;
        apt.cancelledAt = new Date();
        apt.cancellationReason = 'SCHEDULE_CHANGE';
        apt.cancelledBy = 'SYSTEM';

        await manager.save(apt);

        // Giải phóng time slot nếu tồn tại
        if (apt.timeSlotId) {
          await manager
            .createQueryBuilder()
            .softDelete()
            .from(TimeSlot)
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

    // Tắt các slots trùng lặp mà chưa có booking
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

  /**
   * Sử dụng khi lịch TIME_OFF thu hẹp hoặc bị xóa và xóa lịch FLEXIBLE
   */
  private async restoreSlotsFromRegularSchedules(
    manager: EntityManager,
    doctorId: string,
    dayOfWeek: number,
    specificDate: Date,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<number> {
    // Tìm các lịch REGULAR cho ngày này
    const regularSchedules = await manager.find(DoctorSchedule, {
      where: {
        doctorId,
        dayOfWeek,
        scheduleType: ScheduleType.REGULAR,
        isAvailable: true,
      },
      relations: ['doctor'], // Include doctor for validation if needed
    });

    // Lọc các lịch active vào specificDate
    const activeSchedules = regularSchedules.filter((schedule) => {
      if (schedule.effectiveFrom) {
        const from = new Date(schedule.effectiveFrom);
        from.setHours(0, 0, 0, 0);
        if (specificDate < from) return false;
      }
      if (schedule.effectiveUntil) {
        const until = new Date(schedule.effectiveUntil);
        until.setHours(23, 59, 59, 999);
        if (specificDate > until) return false;
      }
      return true;
    });

    let totalRestoredSlots = 0;

    for (const regularSchedule of activeSchedules) {
      // Parse thời gian lịch REGULAR
      const [regStartH, regStartM] = regularSchedule.startTime
        .split(':')
        .map(Number);
      const [regEndH, regEndM] = regularSchedule.endTime.split(':').map(Number);

      const regScheduleStart = new Date(specificDate);
      regScheduleStart.setHours(regStartH, regStartM, 0, 0);

      const regScheduleEnd = new Date(specificDate);
      regScheduleEnd.setHours(regEndH, regEndM, 0, 0);

      // Tính toán overlap giữa lịch REGULAR và khoảng khôi phục
      const overlapStart = new Date(
        Math.max(regScheduleStart.getTime(), rangeStart.getTime()),
      );
      const overlapEnd = new Date(
        Math.min(regScheduleEnd.getTime(), rangeEnd.getTime()),
      );

      if (overlapStart >= overlapEnd) {
        continue; // Không có overlap
      }

      // Tìm các slots hiện có trong khoảng overlap (bao gồm cả unavailalble)
      const existingSlots = await manager.find(TimeSlot, {
        where: {
          doctorId,
          startTime: Between(overlapStart, new Date(overlapEnd.getTime() - 1)), // Avoid getting next slot
        },
      });

      // Tạo slots cho khoảng overlap
      const slotDurationMs = regularSchedule.slotDuration * 60 * 1000;
      let currentStart = new Date(overlapStart);
      const newSlots: TimeSlot[] = [];

      while (currentStart < overlapEnd) {
        const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
        if (slotEnd > overlapEnd) break;

        // Tìm slot trùng khớp
        const matchingSlot = existingSlots.find(
          (s) =>
            Math.abs(s.startTime.getTime() - currentStart.getTime()) < 1000,
        );

        if (matchingSlot) {
          // Nếu slot tồn tại nhưng đang bị disabled (do Time Off trước đó), re-enable nó
          if (!matchingSlot.isAvailable && matchingSlot.bookedCount === 0) {
            matchingSlot.isAvailable = true;
            // Cập nhật lại số lượng capacity nếu cần (reset về default của lịch regular)
            matchingSlot.capacity = regularSchedule.slotCapacity;
            matchingSlot.scheduleId = regularSchedule.id; // Link lại về Regular Schedule
            await manager.save(matchingSlot);
            totalRestoredSlots++;
          }
          // Nếu đã available hoặc đã book, bỏ qua
        } else {
          // Nếu chưa có slot, tạo mới
          const slot = manager.create(TimeSlot, {
            doctorId,
            scheduleId: regularSchedule.id,
            startTime: new Date(currentStart),
            endTime: new Date(slotEnd),
            capacity: regularSchedule.slotCapacity,
            allowedAppointmentTypes: [regularSchedule.appointmentType],
            isAvailable: true,
            bookedCount: 0,
          });
          newSlots.push(slot);
        }

        currentStart = slotEnd;
      }

      if (newSlots.length > 0) {
        await manager.save(TimeSlot, newSlots);
        totalRestoredSlots += newSlots.length;
      }
    }

    return totalRestoredSlots;
  }

  // ========================================
  // PHƯƠNG THỨC XEM TRƯỚC XUNG ĐỘT
  // ========================================

  /**
   * Xem trước xung đột trước khi tạo lịch linh hoạt
   * Trả về danh sách các cuộc hẹn sẽ bị hủy
   */
  async previewFlexibleScheduleConflicts(
    doctorId: string,
    dto: PreviewFlexibleScheduleConflictsDto,
  ): Promise<ResponseCommon<PreviewConflictsResponseDto>> {
    const specificDate = new Date(dto.specificDate);

    // Validate ngày không phải là quá khứ
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (specificDate < today) {
      throw new BadRequestException(
        'Không thể xem trước cho ngày trong quá khứ',
      );
    }

    // Validate thời gian
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    // Parse thời gian
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    // Tìm các cuộc hẹn xung đột
    const startOfDay = new Date(specificDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(specificDate);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startOfDay, endOfDay),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ]),
      },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'timeSlot',
        'timeSlot.schedule',
      ],
    });

    const conflicting = appointments.filter((apt) => {
      // Kiểm tra null/undefined cho timeSlot và schedule
      if (!apt.timeSlot?.schedule?.slotDuration) return false;
      const aptEnd = new Date(
        apt.scheduledAt.getTime() +
          apt.timeSlot.schedule.slotDuration * 60 * 1000,
      );
      return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
    });

    // Tìm các time slots bị ảnh hưởng
    const affectedSlots = await this.timeSlotRepository.count({
      where: {
        doctorId,
        startTime: Between(scheduleStart, scheduleEnd),
        isAvailable: true,
      },
    });

    // Map sang response DTOs
    const conflictingAppointments: ConflictingAppointmentDto[] =
      conflicting.map((apt) => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        patientName: apt.patient?.user?.fullName || 'Unknown',
        scheduledAt: apt.scheduledAt,
        durationMinutes: apt.timeSlot?.schedule?.slotDuration ?? 30,
        status: apt.status,
        appointmentType: apt.appointmentType,
      }));

    const message =
      conflicting.length > 0
        ? `Sẽ có ${conflicting.length} lịch hẹn bị hủy và ${affectedSlots} time slots bị thay thế nếu tạo lịch này.`
        : `Không có lịch hẹn nào bị ảnh hưởng. ${affectedSlots} time slots sẽ bị thay thế.`;

    return new ResponseCommon(200, message, {
      conflictingAppointments,
      affectedSlotsCount: affectedSlots,
      message,
    });
  }

  /**
   * Xem trước xung đột trước khi tạo lịch nghỉ
   * Trả về danh sách các cuộc hẹn sẽ bị hủy
   */
  async previewTimeOffConflicts(
    doctorId: string,
    dto: PreviewTimeOffConflictsDto,
  ): Promise<ResponseCommon<PreviewConflictsResponseDto>> {
    const specificDate = new Date(dto.specificDate);

    // Validate ngày không phải là quá khứ
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (specificDate < today) {
      throw new BadRequestException(
        'Không thể xem trước cho ngày trong quá khứ',
      );
    }

    // Validate thời gian
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    // Parse thời gian
    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    // Tìm các cuộc hẹn xung đột
    const startOfDay = new Date(specificDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(specificDate);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startOfDay, endOfDay),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ]),
      },
      relations: ['patient', 'patient.user'],
    });

    const conflicting = appointments.filter((apt) => {
      const aptEnd = new Date(
        apt.scheduledAt.getTime() +
          apt.timeSlot.schedule.slotDuration * 60 * 1000,
      );
      return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
    });

    // Tìm các time slots bị ảnh hưởng
    const affectedSlots = await this.timeSlotRepository.count({
      where: {
        doctorId,
        startTime: Between(scheduleStart, scheduleEnd),
        bookedCount: 0,
      },
    });

    // Map sang response DTOs
    const conflictingAppointments: ConflictingAppointmentDto[] =
      conflicting.map((apt) => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        patientName: apt.patient?.user?.fullName || 'Unknown',
        scheduledAt: apt.scheduledAt,
        durationMinutes: apt.timeSlot.schedule.slotDuration,
        appointmentType: apt.appointmentType,
        status: apt.status,
      }));

    const message =
      conflicting.length > 0
        ? `Sẽ có ${conflicting.length} lịch hẹn bị hủy và ${affectedSlots} time slots bị tắt nếu tạo lịch nghỉ này.`
        : `Không có lịch hẹn nào bị ảnh hưởng. ${affectedSlots} time slots sẽ bị tắt.`;

    return new ResponseCommon(200, message, {
      conflictingAppointments,
      affectedSlotsCount: affectedSlots,
      message,
    });
  }

  // ========================================
  // Cập nhật lịch cố định với đồng bộ time slot
  // ========================================

  /**
   * ============================================================================
   * CẬP NHẬT LỊCH CỐ ĐỊNH VỚI ĐỒNG BỘ TIME SLOT
   * ============================================================================
   *
   * MỤC ĐÍCH:
   * - Cập nhật thông tin lịch làm việc cố định (REGULAR schedule)
   * - Đồng bộ lại time slots theo thông tin mới
   * - KHÔNG hủy appointments hiện có, chỉ gửi cảnh báo
   *
   * NGUYÊN TẮC:
   * - Thay đổi chỉ áp dụng từ NGÀY MAI (không ảnh hưởng ngày hôm nay)
   * - Chỉ xóa các time slots CHƯA được đặt (bookedCount = 0)
   * - Appointments bị ảnh hưởng sẽ được liệt kê để bác sĩ tự xử lý
   *
   * FLOW:
   * 1. Xóa time slots chưa book từ ngày mai
   * 2. Tìm appointments có thể bị ảnh hưởng (chỉ cảnh báo, không hủy)
   * 3. Cập nhật thông tin DoctorSchedule
   * 4. Tạo time slots mới theo thông tin đã cập nhật
   * 5. Gửi thông báo warning cho appointments bị ảnh hưởng
   * ============================================================================
   */
  private async updateRegularWithSlotSync(
    id: string,
    dto: UpdateDoctorScheduleDto,
    existing: DoctorSchedule,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    // ========================================
    // BƯỚC 0: Xác định giá trị mới (merge với giá trị cũ)
    // ========================================
    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    const newSlotDuration = dto.slotDuration ?? existing.slotDuration;
    const newSlotCapacity = dto.slotCapacity ?? existing.slotCapacity;
    const newAppointmentType = dto.appointmentType ?? existing.appointmentType;

    // ========================================
    // TÍNH TOÁN KHOẢNG THỜI GIAN ÁP DỤNG
    // ========================================
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Range: Từ ngày mai đến 7 ngày sau (hoặc effectiveUntil nếu sớm hơn)
    const rangeEnd = new Date(tomorrow);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    const effectiveUntil = dto.effectiveUntil
      ? new Date(dto.effectiveUntil)
      : existing.effectiveUntil;

    // Lấy ngày kết thúc thực tế (nhỏ hơn giữa rangeEnd và effectiveUntil)
    const actualRangeEnd =
      effectiveUntil && effectiveUntil < rangeEnd ? effectiveUntil : rangeEnd;

    // ========================================
    // BẮT ĐẦU TRANSACTION
    // ========================================
    const result = await this.dataSource.transaction(async (manager) => {
      // ========================================
      // BƯỚC A: TÌM VÀ HỦY APPOINTMENTS BỊ ẢNH HƯỞNG
      // ========================================
      const cancelledAppointments: Appointment[] = [];

      // Chỉ kiểm tra nếu có thay đổi ảnh hưởng đến appointments
      const hasCriticalChanges =
        (dto.dayOfWeek !== undefined && dto.dayOfWeek !== existing.dayOfWeek) ||
        (dto.startTime !== undefined && dto.startTime !== existing.startTime) ||
        (dto.endTime !== undefined && dto.endTime !== existing.endTime) ||
        (dto.appointmentType !== undefined &&
          dto.appointmentType !== existing.appointmentType);

      if (hasCriticalChanges) {
        const checkDate = new Date(tomorrow);
        checkDate.setHours(0, 0, 0, 0);

        while (checkDate <= actualRangeEnd) {
          const isOldDay = checkDate.getDay() === existing.dayOfWeek;
          const isNewDay = checkDate.getDay() === newDayOfWeek;
          const dayChanged =
            dto.dayOfWeek !== undefined && dto.dayOfWeek !== existing.dayOfWeek;

          // Chỉ check appointments nếu:
          // - Đổi ngày: check cả ngày cũ và ngày mới
          // - Không đổi ngày: chỉ check ngày hiện tại (để xem thời gian có conflict không)
          if (
            (dayChanged && (isOldDay || isNewDay)) ||
            (!dayChanged && isNewDay)
          ) {
            const dayStart = new Date(checkDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(checkDate);
            dayEnd.setHours(23, 59, 59, 999);

            // Tìm tất cả appointments đang active trong ngày này
            const dayAppointments = await manager.find(Appointment, {
              where: {
                doctorId: existing.doctorId,
                scheduledAt: Between(dayStart, dayEnd),
                status: In([
                  AppointmentStatusEnum.CONFIRMED,
                  AppointmentStatusEnum.PENDING_PAYMENT,
                  AppointmentStatusEnum.PENDING,
                ]),
              },
              relations: [
                'patient',
                'patient.user',
                'doctor',
                'doctor.user',
                'timeSlot',
                'timeSlot.schedule',
              ],
            });

            if (dayAppointments.length > 0) {
              for (const apt of dayAppointments) {
                let isAffected = false;

                // Case 1: Đổi dayOfWeek và appointment ở ngày CŨ (không còn lịch làm việc)
                if (dayChanged && isOldDay && !isNewDay) {
                  isAffected = true;
                }

                // Case 2: Đổi thời gian và appointment nằm NGOÀI khung giờ mới
                if (dto.startTime || dto.endTime) {
                  const [newStartH, newStartM] = newStartTime
                    .split(':')
                    .map(Number);
                  const [newEndH, newEndM] = newEndTime.split(':').map(Number);

                  const newScheduleStart = new Date(checkDate);
                  newScheduleStart.setHours(newStartH, newStartM, 0, 0);

                  const newScheduleEnd = new Date(checkDate);
                  newScheduleEnd.setHours(newEndH, newEndM, 0, 0);

                  const aptEnd = new Date(
                    apt.scheduledAt.getTime() +
                      apt.timeSlot.schedule.slotDuration * 60 * 1000,
                  );

                  // Appointment nằm ngoài khung giờ mới
                  if (
                    apt.scheduledAt < newScheduleStart ||
                    aptEnd > newScheduleEnd
                  ) {
                    isAffected = true;
                  }
                }

                // Case 3: Đổi appointmentType và appointment có type khác
                if (
                  dto.appointmentType &&
                  apt.appointmentType !== newAppointmentType
                ) {
                  isAffected = true;
                }

                // HỦY APPOINTMENT NẾU BỊ ẢNH HƯỞNG
                if (isAffected) {
                  apt.status = AppointmentStatusEnum.CANCELLED;
                  apt.cancelledAt = new Date();
                  apt.cancellationReason = 'SCHEDULE_CHANGE';
                  apt.cancelledBy = 'DOCTOR';
                  await manager.save(apt);

                  // Giải phóng time slot nếu tồn tại
                  if (apt.timeSlotId) {
                    await manager
                      .createQueryBuilder()
                      .softDelete()
                      .from(TimeSlot)
                      .where('id = :id', { id: apt.timeSlotId })
                      .execute();
                  }
                  cancelledAppointments.push(apt);
                }
              }
            }
          }

          checkDate.setDate(checkDate.getDate() + 1);
        }
      }

      // ========================================
      // BƯỚC B: XÓA TIME SLOTS TỪ NGÀY MAI
      // ========================================
      const deleteQuery = manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('scheduleId = :scheduleId', { scheduleId: id })
        .andWhere('startTime >= :tomorrow', { tomorrow })
        .andWhere('startTime <= :rangeEnd', { rangeEnd: actualRangeEnd })
        .andWhere('bookedCount = 0');

      // Nếu ĐỔI dayOfWeek, chỉ xóa slots của lịch cũ
      if (dto.dayOfWeek !== undefined && dto.dayOfWeek !== existing.dayOfWeek) {
        deleteQuery.andWhere('EXTRACT(DOW FROM "startTime") = :dow', {
          dow: existing.dayOfWeek,
        });
      }

      await deleteQuery.execute();

      // ========================================
      // BƯỚC C: CẬP NHẬT THÔNG TIN DOCTOR SCHEDULE
      // ========================================
      await manager.update(DoctorSchedule, id, {
        dayOfWeek: newDayOfWeek,
        startTime: newStartTime,
        endTime: newEndTime,
        slotDuration: newSlotDuration,
        slotCapacity: newSlotCapacity,
        appointmentType: newAppointmentType,
        consultationFee:
          dto.consultationFee !== undefined
            ? (dto.consultationFee?.toString() ?? null)
            : undefined,
        isAvailable: dto.isAvailable,
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
      });

      // ========================================
      // BƯỚC D: TẠO TIME SLOTS MỚI TỪ NGÀY MAI
      // ========================================
      let totalGeneratedSlots = 0;
      let skippedDaysByHigherPriority = 0;
      const slotGenDate = new Date(tomorrow); // Bắt đầu từ ngày mai
      const regularPriority = SCHEDULE_TYPE_PRIORITY[ScheduleType.REGULAR];

      while (slotGenDate <= actualRangeEnd) {
        // Chỉ tạo slot cho ngày MỚI (theo newDayOfWeek)
        if (slotGenDate.getDay() === newDayOfWeek) {
          // Kiểm tra có schedule priority cao hơn không (TIME_OFF, FLEXIBLE)
          const dayStart = new Date(slotGenDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(slotGenDate);
          dayEnd.setHours(23, 59, 59, 999);

          const higherPrioritySchedules = await manager.find(DoctorSchedule, {
            where: {
              doctorId: existing.doctorId,
              priority: MoreThan(regularPriority),
              specificDate: Between(dayStart, dayEnd),
            },
          });

          // Nếu có schedule priority cao hơn → SKIP ngày này
          if (higherPrioritySchedules.length > 0) {
            skippedDaysByHigherPriority++;
            slotGenDate.setDate(slotGenDate.getDate() + 1);
            continue;
          }

          // Parse thời gian bắt đầu và kết thúc
          const [startH, startM] = newStartTime.split(':').map(Number);
          const [endH, endM] = newEndTime.split(':').map(Number);

          const scheduleStart = new Date(slotGenDate);
          scheduleStart.setHours(startH, startM, 0, 0);

          const scheduleEnd = new Date(slotGenDate);
          scheduleEnd.setHours(endH, endM, 0, 0);

          // Tìm slots hiện có để tránh trùng lặp (có thể từ schedule khác hoặc đã book)
          const existingSlots = await manager.find(TimeSlot, {
            where: {
              doctorId: existing.doctorId,
              startTime: Between(scheduleStart, scheduleEnd),
            },
          });

          // Tạo slots mới theo slotDuration
          const slotDurationMs = newSlotDuration * 60 * 1000;
          let currentStart = new Date(scheduleStart);
          const newSlots: TimeSlot[] = [];

          while (currentStart < scheduleEnd) {
            const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
            if (slotEnd > scheduleEnd) break;

            // Kiểm tra overlap với slots hiện có
            const hasOverlap = existingSlots.some(
              (s) => currentStart < s.endTime && slotEnd > s.startTime,
            );

            // Chỉ tạo slot nếu không overlap
            if (!hasOverlap) {
              const slot = manager.create(TimeSlot, {
                doctorId: existing.doctorId,
                scheduleId: id,
                startTime: new Date(currentStart),
                endTime: new Date(slotEnd),
                capacity: newSlotCapacity,
                allowedAppointmentTypes: [newAppointmentType],
                isAvailable: true,
                bookedCount: 0,
              });
              newSlots.push(slot);
            }

            currentStart = slotEnd;
          }

          // Lưu tất cả slots mới
          if (newSlots.length > 0) {
            await manager.save(TimeSlot, newSlots);
            totalGeneratedSlots += newSlots.length;
          }
        }

        slotGenDate.setDate(slotGenDate.getDate() + 1);
      }

      // Lấy thông tin schedule đã cập nhật
      const updated = await manager.findOne(DoctorSchedule, { where: { id } });

      return {
        schedule: updated!,
        generatedSlots: totalGeneratedSlots,
        skippedDaysByHigherPriority,
        cancelledAppointments,
      };
    });

    // ========================================
    // BƯỚC E: GỬI THÔNG BÁO CHO BỆNH NHÂN BỊ HỦY LỊCH
    // ========================================
    // Thực hiện ngoài transaction để không block nếu gửi notification thất bại
    if (result.cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(
          result.cancelledAppointments,
          'SCHEDULE_CHANGE',
        )
        .catch((err) => console.error('Failed to send notifications:', err));
    }

    // ========================================
    // TẠO MESSAGE PHẢN HỒI RÕ RÀNG
    // ========================================
    let message = `Cập nhật lịch cố định thành công. Thay đổi áp dụng từ ngày ${tomorrow.toLocaleDateString('vi-VN')}.`;

    // Thông báo số appointments đã bị hủy
    if (result.cancelledAppointments.length > 0) {
      message += ` Đã hủy ${result.cancelledAppointments.length} lịch hẹn bị ảnh hưởng.`;
    }

    message += ` Đã tạo ${result.generatedSlots} time slots mới.`;

    // Thông báo số ngày bị skip do có lịch ưu tiên cao hơn
    if (result.skippedDaysByHigherPriority > 0) {
      message += ` (${result.skippedDaysByHigherPriority} ngày bị bỏ qua do có lịch ưu tiên cao hơn)`;
    }

    return new ResponseCommon(200, message, result.schedule);
  }

  // ========================================
  // HELPERS TẠO SLOTS TỰ ĐỘNG
  // ========================================

  /**
   * Tạo time slots cho một lịch trong khoảng ngày
   * Tôn trọng priority: bỏ qua các ngày có lịch priority cao hơn
   */
  async generateSlotsForSchedule(
    schedule: DoctorSchedule,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const regularPriority = SCHEDULE_TYPE_PRIORITY[ScheduleType.REGULAR];
    let totalGeneratedSlots = 0;

    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      // Chỉ xử lý nếu ngày khớp với dayOfWeek của schedule
      if (currentDate.getDay() === schedule.dayOfWeek) {
        // Kiểm tra schedule có active trong ngày này không
        if (!this.isScheduleActiveOnDate(schedule, currentDate)) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Kiểm tra xem có schedule priority cao hơn trong ngày này không
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const higherPrioritySchedules = await this.scheduleRepository.find({
          where: {
            doctorId: schedule.doctorId,
            priority: MoreThan(regularPriority),
            specificDate: Between(dayStart, dayEnd),
          },
        });

        // Nếu có schedule priority cao hơn → skip cả ngày
        if (higherPrioritySchedules.length > 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        // Tạo slots cho ngày này
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);

        const scheduleStart = new Date(currentDate);
        scheduleStart.setHours(startH, startM, 0, 0);

        const scheduleEnd = new Date(currentDate);
        scheduleEnd.setHours(endH, endM, 0, 0);

        // Kiểm tra slots đã tồn tại
        const existingSlots = await this.dataSource.manager.find(TimeSlot, {
          where: {
            doctorId: schedule.doctorId,
            startTime: Between(scheduleStart, scheduleEnd),
          },
        });

        // Tạo slots mới
        const slotDurationMs = schedule.slotDuration * 60 * 1000;
        let slotStart = new Date(scheduleStart);
        const newSlots: TimeSlot[] = [];

        while (slotStart < scheduleEnd) {
          const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
          if (slotEnd > scheduleEnd) break;

          // Kiểm tra không overlap với slots hiện có
          const hasOverlap = existingSlots.some(
            (s) => slotStart < s.endTime && slotEnd > s.startTime,
          );

          if (!hasOverlap) {
            const slot = this.dataSource.manager.create(TimeSlot, {
              doctorId: schedule.doctorId,
              scheduleId: schedule.id,
              startTime: new Date(slotStart),
              endTime: new Date(slotEnd),
              capacity: schedule.slotCapacity,
              allowedAppointmentTypes: [schedule.appointmentType],
              isAvailable: true,
              bookedCount: 0,
            });
            newSlots.push(slot);
          }

          slotStart = slotEnd;
        }

        if (newSlots.length > 0) {
          await this.dataSource.manager.save(TimeSlot, newSlots);
          totalGeneratedSlots += newSlots.length;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalGeneratedSlots;
  }

  /**
   * Kiểm tra xem một lịch có active vào ngày cụ thể không
   */
  private isScheduleActiveOnDate(
    schedule: DoctorSchedule,
    date: Date,
  ): boolean {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (schedule.effectiveFrom) {
      const effectiveFrom = new Date(schedule.effectiveFrom);
      effectiveFrom.setHours(0, 0, 0, 0);
      if (checkDate.getTime() < effectiveFrom.getTime()) return false;
    }

    if (schedule.effectiveUntil) {
      const effectiveUntil = new Date(schedule.effectiveUntil);
      effectiveUntil.setHours(23, 59, 59, 999);
      if (checkDate.getTime() > effectiveUntil.getTime()) return false;
    }

    return true;
  }

  /**
   * Disable ALL old slots (slots that are in the past)
   * Ensures no new bookings can be made on past time slots
   * Called by cron job daily
   */
  async disableOldSlots(): Promise<number> {
    const now = new Date();

    const result = await this.dataSource
      .createQueryBuilder()
      .update(TimeSlot)
      .set({ isAvailable: false })
      .where('startTime < :now', { now })
      .andWhere('isAvailable = true')
      .execute();

    return result.affected || 0;
  }

  /**
   * Generate slots for the next day for all active doctors
   * Called by cron job daily
   */
  async generateSlotsForNextDay(): Promise<{
    doctorsProcessed: number;
    slotsGenerated: number;
  }> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setHours(23, 59, 59, 999);

    const tomorrowDayOfWeek = tomorrow.getDay();

    // Tìm tất cả REGULAR schedules active cho ngày mai
    const activeSchedules = await this.scheduleRepository
      .createQueryBuilder('s')
      .where('s.scheduleType = :type', { type: ScheduleType.REGULAR })
      .andWhere('s.dayOfWeek = :dow', { dow: tomorrowDayOfWeek })
      .andWhere('s.isAvailable = true')
      .andWhere('(s.effectiveFrom IS NULL OR s.effectiveFrom <= :date)', {
        date: tomorrow,
      })
      .andWhere('(s.effectiveUntil IS NULL OR s.effectiveUntil >= :date)', {
        date: tomorrow,
      })
      .getMany();

    let totalSlotsGenerated = 0;
    const doctorIds = new Set<string>();

    for (const schedule of activeSchedules) {
      doctorIds.add(schedule.doctorId);

      const slotsGenerated = await this.generateSlotsForSchedule(
        schedule,
        tomorrow,
        dayAfterTomorrow,
      );
      totalSlotsGenerated += slotsGenerated;
    }

    return {
      doctorsProcessed: doctorIds.size,
      slotsGenerated: totalSlotsGenerated,
    };
  }
}
