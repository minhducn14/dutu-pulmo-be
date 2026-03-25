import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  In,
  MoreThan,
  Repository,
} from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import {
  AppointmentCancellationCoreService,
  AppointmentCancellationPostCommitEffect,
} from '@/modules/appointment/services/appointment-cancellation-core.service';
import { CreateDoctorScheduleDto } from '@/modules/doctor/dto/create-doctor-schedule.dto';
import { UpdateDoctorScheduleDto } from '@/modules/doctor/dto/update-doctor-schedule.dto';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import {
  ScheduleType,
  SCHEDULE_TYPE_PRIORITY,
} from '@/modules/common/enums/schedule-type.enum';
import { NotificationService } from '@/modules/notification/notification.service';
import { DoctorScheduleHelperService } from '@/modules/doctor/services/doctor-schedule-helper.service';
import { DoctorScheduleSlotService } from '@/modules/doctor/services/doctor-schedule-slot.service';
import {
  addDaysVN,
  endOfDayVN,
  startOfDayVN,
  vnNow,
  getDayVN,
  formatDateVN,
  getTimeMinutesVN,
} from '@/common/datetime';

@Injectable()
export class DoctorScheduleRegularService {
  private readonly logger = new Logger(DoctorScheduleRegularService.name);
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    private readonly dataSource: DataSource,
    private readonly helper: DoctorScheduleHelperService,
    private readonly slotService: DoctorScheduleSlotService,
    private readonly notificationService: NotificationService,
    private readonly appointmentCancellationCore: AppointmentCancellationCoreService,
  ) {}

  // ==================== CREATE ====================

  async createRegular(
    doctorId: string,
    dto: CreateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });

    if (!doctor) {
      this.logger.error('Doctor not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const scheduleType = ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
      this.logger.error(
        'Invalid day of week. Day of week must be between 0 and 6',
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    this.helper.validateTimeRange(dto);

    const minDays = dto.minimumBookingDays ?? 0;
    const maxDays = dto.maxAdvanceBookingDays ?? 30;
    this.helper.validateBookingDaysConstraints(minDays, maxDays);

    const isAvailable = dto.isAvailable ?? true;

    const effectiveFromDate = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : null;
    const effectiveUntilDate = dto.effectiveUntil
      ? new Date(dto.effectiveUntil)
      : null;

    await this.helper.checkOverlap(
      doctorId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
      effectiveFromDate,
      effectiveUntilDate,
      priority,
    );

    if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (!doctor?.primaryHospitalId) {
        this.logger.error('Doctor does not have a primary hospital');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

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

    const { saved, generatedSlotsCount } = await this.dataSource.transaction(
      async (manager) => {
        const saved = await manager.save(DoctorSchedule, schedule);

        const now = vnNow();
        const startOfToday = startOfDayVN(now);
        const startDate = addDaysVN(startOfToday, 1);
        const endDate = addDaysVN(startOfToday, 30);

        const generatedSlotsCount =
          await this.slotService.generateSlotsForSchedule(
            saved,
            startDate,
            endDate,
            manager,
          );

        return { saved, generatedSlotsCount };
      },
    );

    let message = 'Tạo lịch làm việc cố định thành công';
    if (!effectiveUntilDate) {
      message += ' (lịch vô thời hạn)';
    }
    if (generatedSlotsCount > 0) {
      message += `. Đã tự động tạo ${generatedSlotsCount} time slots cho 30 ngày tới.`;
    }

    const isShadowed = await this.helper.hasShadowingSchedule(
      doctorId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
      effectiveFromDate,
      effectiveUntilDate,
      priority,
    );
    if (isShadowed) {
      message +=
        ' (Lưu ý: Một số ngày trong lịch này trùng với lịch Nghỉ/Linh hoạt đã có và sẽ bị ghi đè)';
    }

    return new ResponseCommon(201, message, saved);
  }

  async createManyRegular(
    doctorId: string,
    dtos: CreateDoctorScheduleDto[],
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });

    if (!doctor) {
      this.logger.error('Doctor not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    if (dtos.length === 0) {
      this.logger.error('No schedules provided');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const scheduleType = ScheduleType.REGULAR;
    const priority = SCHEDULE_TYPE_PRIORITY[scheduleType];

    const dtosWithPriority = dtos.map((dto) => ({
      ...dto,
      scheduleType,
      priority,
      isAvailable: dto.isAvailable ?? true,
    }));

    for (const dto of dtosWithPriority) {
      if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      this.helper.validateTimeRange(dto);

      const minDays = dto.minimumBookingDays ?? 0;
      const maxDays = dto.maxAdvanceBookingDays ?? 30;
      this.helper.validateBookingDaysConstraints(minDays, maxDays);

      if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
        if (!doctor?.primaryHospitalId) {
          this.logger.error('Doctor does not have a primary hospital');
          throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }
      }
    }

    for (const dto of dtosWithPriority) {
      const effectiveFromDate = dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : null;
      const effectiveUntilDate = dto.effectiveUntil
        ? new Date(dto.effectiveUntil)
        : null;

      await this.helper.checkOverlap(
        doctorId,
        dto.dayOfWeek,
        dto.startTime,
        dto.endTime,
        effectiveFromDate,
        effectiveUntilDate,
        dto.priority,
      );
    }

    for (let i = 0; i < dtosWithPriority.length; i++) {
      for (let j = i + 1; j < dtosWithPriority.length; j++) {
        if (dtosWithPriority[i].dayOfWeek === dtosWithPriority[j].dayOfWeek) {
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
              throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
            }
          }
        }
      }
    }

    const { result, totalGeneratedSlots } = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const entities = dtosWithPriority.map((dto) =>
          manager.create(DoctorSchedule, {
            ...dto,
            doctorId,
            scheduleType,
            priority,
            isAvailable: dto.isAvailable ?? true,
            consultationFee: dto.consultationFee?.toString() ?? null,
            effectiveFrom: dto.effectiveFrom
              ? new Date(dto.effectiveFrom)
              : null,
            effectiveUntil: dto.effectiveUntil
              ? new Date(dto.effectiveUntil)
              : null,
            minimumBookingTime: (dto.minimumBookingDays ?? 0) * 24 * 60,
            maxAdvanceBookingDays: dto.maxAdvanceBookingDays ?? 30,
          }),
        );

        const savedSchedules = await manager.save(DoctorSchedule, entities);

        const now = vnNow();
        const startOfToday = startOfDayVN(now);
        const startDate = addDaysVN(startOfToday, 1);
        const endDate = addDaysVN(startOfToday, 30);

        let slotsCount = 0;
        await Promise.all(
          savedSchedules.map(async (schedule) => {
            const count = await this.slotService.generateSlotsForSchedule(
              schedule,
              startDate,
              endDate,
              manager,
            );
            slotsCount += count;
          }),
        );

        return { result: savedSchedules, totalGeneratedSlots: slotsCount };
      },
    );

    let hasShadowing = false;
    for (const dto of dtosWithPriority) {
      if (
        await this.helper.hasShadowingSchedule(
          doctorId,
          dto.dayOfWeek,
          dto.startTime,
          dto.endTime,
          dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
          dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
          priority,
        )
      ) {
        hasShadowing = true;
        break;
      }
    }

    let resultMessage = `Tạo ${result.length} lịch làm việc thành công. Đã tự động tạo ${totalGeneratedSlots} time slots cho 30 ngày tới.`;
    if (hasShadowing) {
      resultMessage +=
        ' (Lưu ý: Một số ngày trùng với lịch Nghỉ/Linh hoạt đã có và sẽ bị ghi đè)';
    }

    return new ResponseCommon(201, resultMessage, result);
  }

  // ==================== UPDATE ====================

  async updateRegular(
    doctorId: string,
    id: string,
    dto: UpdateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existing = await this.scheduleRepository.findOne({
      where: { id, doctorId },
    });
    if (!existing) {
      this.logger.error('Schedule not found or unauthorized');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    if (existing.scheduleType !== ScheduleType.REGULAR) {
      this.logger.error('Invalid schedule type');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    this.helper.validateTimeRange(dto);

    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    const newSlotDuration = dto.slotDuration ?? existing.slotDuration;
    const priority = existing.priority;
    const newIsAvailable = dto.isAvailable ?? existing.isAvailable;
    const existingMinimumBookingDays = Math.floor(
      (existing.minimumBookingTime ?? 0) / (24 * 60),
    );

    this.helper.validateMergedTimeRange(
      newStartTime,
      newEndTime,
      newSlotDuration,
    );

    // Tính giá trị effective dates mới
    const newEffectiveFrom: Date | null =
      dto.effectiveFrom !== undefined
        ? dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : null
        : existing.effectiveFrom;

    const newEffectiveUntil: Date | null =
      dto.effectiveUntil !== undefined
        ? dto.effectiveUntil
          ? new Date(dto.effectiveUntil)
          : null
        : existing.effectiveUntil;
    const newMinimumBookingDays =
      dto.minimumBookingDays ?? existingMinimumBookingDays;
    const newMaxAdvanceBookingDays =
      dto.maxAdvanceBookingDays ?? existing.maxAdvanceBookingDays;

    this.helper.validateBookingDaysConstraints(
      newMinimumBookingDays,
      newMaxAdvanceBookingDays,
    );

    if (
      newEffectiveFrom &&
      newEffectiveUntil &&
      newEffectiveFrom > newEffectiveUntil
    ) {
      this.logger.error(
        'Invalid effective date range after update merge (effectiveFrom > effectiveUntil)',
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.effectiveFrom !== undefined ||
      dto.effectiveUntil !== undefined
    ) {
      await this.helper.checkOverlap(
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

    const newAppointmentType = dto.appointmentType ?? existing.appointmentType;
    if (newAppointmentType === AppointmentTypeEnum.IN_CLINIC) {
      const doctor = await this.doctorRepository.findOne({
        where: { id: existing.doctorId },
        select: ['id', 'primaryHospitalId'],
      });
      if (!doctor?.primaryHospitalId) {
        this.logger.error('Doctor does not have a primary hospital');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    // timeChanged hoặc isAvailable thay đổi: các trường ảnh hưởng đến cấu trúc slot hoặc availability
    const timeChanged =
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.slotDuration !== undefined ||
      dto.slotCapacity !== undefined ||
      dto.appointmentType !== undefined;

    const isAvailableToggled =
      dto.isAvailable !== undefined && dto.isAvailable !== existing.isAvailable;

    // updateRegularWithSlotSync xử lý cả effective date change khi có timeChanged hoặc isAvailable đổi
    if (timeChanged || isAvailableToggled) {
      const syncResult = await this.updateRegularWithSlotSync(
        id,
        dto,
        existing,
      );
      return new ResponseCommon(
        syncResult.code,
        syncResult.message,
        syncResult.data!.schedule,
      );
    }

    // Nhánh chỉ thay đổi effective dates (không có time/slot change)
    const effectiveDateChanged =
      dto.effectiveFrom !== undefined || dto.effectiveUntil !== undefined;

    if (effectiveDateChanged) {
      const result = await this.dataSource.transaction(async (manager) => {
        const cancellationEffects: AppointmentCancellationPostCommitEffect[] =
          [];
        // Xử lý thu hẹp: cancel appointments + xóa slots ngoài range mới
        const cancelledAppointments = await this._handleEffectiveShrink(
          existing,
          newEffectiveFrom,
          newEffectiveUntil,
          manager,
          cancellationEffects,
        );

        // Xử lý mở rộng: generate thêm slots cho range mới mở
        const generatedSlots = await this._handleEffectiveExpand(
          existing,
          newEffectiveFrom,
          newEffectiveUntil,
          manager,
        );

        await manager.update(DoctorSchedule, id, {
          isAvailable: newIsAvailable,
          effectiveFrom: newEffectiveFrom,
          effectiveUntil: newEffectiveUntil,
          note: dto.note !== undefined ? dto.note : existing.note,
          consultationFee:
            dto.consultationFee !== undefined
              ? (dto.consultationFee?.toString() ?? null)
              : existing.consultationFee,
          discountPercent: dto.discountPercent ?? existing.discountPercent,
          minimumBookingTime:
            dto.minimumBookingDays !== undefined
              ? dto.minimumBookingDays * 24 * 60
              : existing.minimumBookingTime,
          maxAdvanceBookingDays:
            dto.maxAdvanceBookingDays ?? existing.maxAdvanceBookingDays,
        });

        const updated = await manager.findOne(DoctorSchedule, {
          where: { id },
        });

        let message = 'Cập nhật lịch làm việc cố định thành công.';
        if (cancelledAppointments.length > 0) {
          message += ` Đã hủy ${cancelledAppointments.length} lịch hẹn ngoài khoảng hiệu lực mới.`;
        }
        if (generatedSlots > 0) {
          message += ` Đã tạo thêm ${generatedSlots} time slots cho khoảng mới mở.`;
        }

        return {
          response: new ResponseCommon(200, message, updated!),
          cancelledAppointments,
          cancellationEffects,
        };
      });

      this.appointmentCancellationCore.schedulePostCommitEffects(
        result.cancellationEffects,
      );
      if (result.cancelledAppointments.length > 0) {
        this.notificationService
          .notifyCancelledAppointments(
            result.cancelledAppointments,
            'SCHEDULE_CHANGE',
          )
          .catch((err) => {
            const appointmentIds = result.cancelledAppointments
              .map((a) => a.id)
              .join(',');
            this.logger.error(
              `Failed to send notifications for ${result.cancelledAppointments.length} appointments (doctorId=${existing.doctorId}, appointmentIds=${appointmentIds})`,
              err instanceof Error ? err.stack : String(err),
            );
          });
      }

      return result.response;
    }

    const updateData: Partial<DoctorSchedule> = {
      ...dto,
      priority,
      isAvailable: newIsAvailable,
      minimumBookingTime:
        dto.minimumBookingDays !== undefined
          ? dto.minimumBookingDays * 24 * 60
          : existing.minimumBookingTime,
      consultationFee:
        dto.consultationFee !== undefined
          ? (dto.consultationFee?.toString() ?? null)
          : existing.consultationFee,
      effectiveFrom: newEffectiveFrom,
      effectiveUntil: newEffectiveUntil,
    };

    const dataToUpdate = updateData as Record<string, unknown>;
    delete dataToUpdate.id;
    delete dataToUpdate.minimumBookingDays;
    delete dataToUpdate.dayOfWeek;
    delete dataToUpdate.startTime;
    delete dataToUpdate.endTime;
    delete dataToUpdate.slotDuration;
    delete dataToUpdate.slotCapacity;
    delete dataToUpdate.appointmentType;

    (Object.keys(updateData) as (keyof typeof updateData)[]).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
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

  async updateManyRegular(
    doctorId: string,
    items: UpdateDoctorScheduleDto[],
  ): Promise<
    ResponseCommon<{
      updatedSchedules: DoctorSchedule[];
      totalGeneratedSlots: number;
      totalWarningAppointments: number;
      failedUpdates: { id: string; reason: string }[];
    }>
  > {
    if (!items || items.length === 0) {
      this.logger.error('No schedules provided');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });

    if (!doctor) {
      this.logger.error('Doctor not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const scheduleIds = items.map((item) => item.id);

    const existingSchedules = await this.scheduleRepository.find({
      where: {
        id: In(scheduleIds),
        doctorId,
      },
    });

    const scheduleMap = new Map<string, DoctorSchedule>();
    for (const schedule of existingSchedules) {
      scheduleMap.set(schedule.id, schedule);
    }

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
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    if (notRegularIds.length > 0) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const updatedSchedules: DoctorSchedule[] = [];
    const failedUpdates: { id: string; reason: string }[] = [];
    let totalGeneratedSlots = 0;
    let totalWarningAppointments = 0;

    for (const item of items) {
      const { id, ...updateData } = item;
      const existing = scheduleMap.get(id)!;

      try {
        const mergedStartTime = updateData.startTime ?? existing.startTime;
        const mergedEndTime = updateData.endTime ?? existing.endTime;
        const mergedDayOfWeek = updateData.dayOfWeek ?? existing.dayOfWeek;
        const mergedSlotDuration =
          updateData.slotDuration ?? existing.slotDuration;
        const mergedEffectiveFrom =
          updateData.effectiveFrom !== undefined
            ? updateData.effectiveFrom
              ? new Date(updateData.effectiveFrom)
              : null
            : existing.effectiveFrom;
        const mergedEffectiveUntil =
          updateData.effectiveUntil !== undefined
            ? updateData.effectiveUntil
              ? new Date(updateData.effectiveUntil)
              : null
            : existing.effectiveUntil;
        const existingMinimumBookingDays = Math.floor(
          (existing.minimumBookingTime ?? 0) / (24 * 60),
        );
        const mergedMinimumBookingDays =
          updateData.minimumBookingDays ?? existingMinimumBookingDays;
        const mergedMaxAdvanceBookingDays =
          updateData.maxAdvanceBookingDays ?? existing.maxAdvanceBookingDays;
        const mergedAppointmentType =
          updateData.appointmentType ?? existing.appointmentType;

        this.helper.validateBookingDaysConstraints(
          mergedMinimumBookingDays,
          mergedMaxAdvanceBookingDays,
        );
        this.helper.validateMergedTimeRange(
          mergedStartTime,
          mergedEndTime,
          mergedSlotDuration,
        );

        if (
          mergedAppointmentType === AppointmentTypeEnum.IN_CLINIC &&
          !doctor.primaryHospitalId
        ) {
          this.logger.error('Doctor does not have a primary hospital');
          throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }

        if (updateData.startTime || updateData.endTime) {
          const tempDto: UpdateDoctorScheduleDto = {
            id,
            startTime: mergedStartTime,
            endTime: mergedEndTime,
            slotDuration: mergedSlotDuration,
          };
          this.helper.validateTimeRange(tempDto);
        }

        const hasOverlapRelatedChanges =
          (updateData.dayOfWeek !== undefined &&
            updateData.dayOfWeek !== existing.dayOfWeek) ||
          (updateData.startTime !== undefined &&
            updateData.startTime !== existing.startTime) ||
          (updateData.endTime !== undefined &&
            updateData.endTime !== existing.endTime) ||
          updateData.effectiveFrom !== undefined ||
          updateData.effectiveUntil !== undefined;

        if (hasOverlapRelatedChanges) {
          await this.helper.checkOverlap(
            doctorId,
            mergedDayOfWeek,
            mergedStartTime,
            mergedEndTime,
            mergedEffectiveFrom,
            mergedEffectiveUntil,
            existing.priority,
            id,
          );
        }

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
            updateData.appointmentType !== existing.appointmentType) ||
          (updateData.isAvailable !== undefined &&
            updateData.isAvailable !== existing.isAvailable) ||
          updateData.effectiveFrom !== undefined ||
          updateData.effectiveUntil !== undefined;

        if (hasCriticalChanges) {
          const updateDto: UpdateDoctorScheduleDto = {
            id,
            dayOfWeek: updateData.dayOfWeek,
            startTime: updateData.startTime,
            endTime: updateData.endTime,
            slotDuration: updateData.slotDuration,
            slotCapacity: updateData.slotCapacity,
            appointmentType: updateData.appointmentType,
            consultationFee: updateData.consultationFee,
            discountPercent: updateData.discountPercent,
            minimumBookingDays: updateData.minimumBookingDays,
            maxAdvanceBookingDays: updateData.maxAdvanceBookingDays,
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
            updatedSchedules.push(result.data.schedule);
            totalGeneratedSlots += result.data.generatedSlots;
            totalWarningAppointments += result.data.cancelledCount;
          }
        } else {
          await this.scheduleRepository.update(id, {
            note: updateData.note,
            consultationFee:
              updateData.consultationFee !== undefined
                ? (updateData.consultationFee?.toString() ?? null)
                : undefined,
            discountPercent: updateData.discountPercent,
            minimumBookingTime:
              updateData.minimumBookingDays !== undefined
                ? updateData.minimumBookingDays * 24 * 60
                : existing.minimumBookingTime,
            maxAdvanceBookingDays: updateData.maxAdvanceBookingDays,
            isAvailable: updateData.isAvailable,
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

    let message = `Đã cập nhật thành công ${updatedSchedules.length}/${items.length} lịch làm việc.`;

    if (totalGeneratedSlots > 0) {
      message += ` Tổng cộng tạo ${totalGeneratedSlots} time slots mới.`;
    }

    if (totalWarningAppointments > 0) {
      message += ` ${totalWarningAppointments} lịch hẹn có thể bị ảnh hưởng.`;
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

  private async updateRegularWithSlotSync(
    id: string,
    dto: UpdateDoctorScheduleDto,
    existing: DoctorSchedule,
  ): Promise<
    ResponseCommon<{
      schedule: DoctorSchedule;
      generatedSlots: number;
      cancelledCount: number;
    }>
  > {
    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    const newSlotDuration = dto.slotDuration ?? existing.slotDuration;
    const newSlotCapacity = dto.slotCapacity ?? existing.slotCapacity;
    const newAppointmentType = dto.appointmentType ?? existing.appointmentType;

    // Tính effective dates mới
    const newEffectiveFrom: Date | null =
      dto.effectiveFrom !== undefined
        ? dto.effectiveFrom
          ? new Date(dto.effectiveFrom)
          : null
        : existing.effectiveFrom;

    const newEffectiveUntil: Date | null =
      dto.effectiveUntil !== undefined
        ? dto.effectiveUntil
          ? new Date(dto.effectiveUntil)
          : null
        : existing.effectiveUntil;
    const existingMinimumBookingDays = Math.floor(
      (existing.minimumBookingTime ?? 0) / (24 * 60),
    );
    const newMinimumBookingDays =
      dto.minimumBookingDays ?? existingMinimumBookingDays;
    const newMaxAdvanceBookingDays =
      dto.maxAdvanceBookingDays ?? existing.maxAdvanceBookingDays;

    this.helper.validateBookingDaysConstraints(
      newMinimumBookingDays,
      newMaxAdvanceBookingDays,
    );
    this.helper.validateMergedTimeRange(
      newStartTime,
      newEndTime,
      newSlotDuration,
    );

    if (
      newEffectiveFrom &&
      newEffectiveUntil &&
      newEffectiveFrom > newEffectiveUntil
    ) {
      this.logger.error(
        'Invalid effective date range for slot sync (effectiveFrom > effectiveUntil)',
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (newAppointmentType === AppointmentTypeEnum.IN_CLINIC) {
      const doctor = await this.doctorRepository.findOne({
        where: { id: existing.doctorId },
        select: ['id', 'primaryHospitalId'],
      });
      if (!doctor?.primaryHospitalId) {
        this.logger.error('Doctor does not have a primary hospital');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    const now = vnNow();
    const today = startOfDayVN(now);
    const tomorrow = addDaysVN(today, 1);
    const maxWindow = addDaysVN(today, 30);

    // actualRangeStart: từ tomorrow hoặc newEffectiveFrom nếu muộn hơn
    const actualRangeStart =
      newEffectiveFrom && newEffectiveFrom > tomorrow
        ? startOfDayVN(newEffectiveFrom)
        : tomorrow;

    // actualRangeEnd: đến maxWindow hoặc newEffectiveUntil nếu sớm hơn
    const actualRangeEnd =
      newEffectiveUntil && newEffectiveUntil < maxWindow
        ? startOfDayVN(newEffectiveUntil)
        : maxWindow;

    const result = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const currentExisting = await manager.findOne(DoctorSchedule, {
          where: { id, doctorId: existing.doctorId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!currentExisting) {
          this.logger.error('Schedule not found during slot sync');
          throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
        }

        const cancellationEffects: AppointmentCancellationPostCommitEffect[] =
          [];
        const currentNewDayOfWeek = dto.dayOfWeek ?? currentExisting.dayOfWeek;
        const currentNewStartTime = dto.startTime ?? currentExisting.startTime;
        const currentNewEndTime = dto.endTime ?? currentExisting.endTime;
        const currentNewSlotDuration =
          dto.slotDuration ?? currentExisting.slotDuration;
        const currentNewSlotCapacity =
          dto.slotCapacity ?? currentExisting.slotCapacity;
        const currentNewAppointmentType =
          dto.appointmentType ?? currentExisting.appointmentType;
        const currentNewEffectiveFrom: Date | null =
          dto.effectiveFrom !== undefined
            ? dto.effectiveFrom
              ? new Date(dto.effectiveFrom)
              : null
            : currentExisting.effectiveFrom;
        const currentNewEffectiveUntil: Date | null =
          dto.effectiveUntil !== undefined
            ? dto.effectiveUntil
              ? new Date(dto.effectiveUntil)
              : null
            : currentExisting.effectiveUntil;
        const currentNewIsAvailable =
          dto.isAvailable ?? currentExisting.isAvailable;
        const currentActualRangeStart =
          currentNewEffectiveFrom && currentNewEffectiveFrom > tomorrow
            ? startOfDayVN(currentNewEffectiveFrom)
            : tomorrow;
        const currentActualRangeEnd =
          currentNewEffectiveUntil && currentNewEffectiveUntil < maxWindow
            ? startOfDayVN(currentNewEffectiveUntil)
            : maxWindow;
        const cancelledAppointments: Appointment[] = [];

        const hasCriticalChanges =
          (dto.dayOfWeek !== undefined &&
            dto.dayOfWeek !== currentExisting.dayOfWeek) ||
          (dto.startTime !== undefined &&
            dto.startTime !== currentExisting.startTime) ||
          (dto.endTime !== undefined &&
            dto.endTime !== currentExisting.endTime) ||
          (dto.isAvailable !== undefined &&
            dto.isAvailable !== currentExisting.isAvailable) ||
          (dto.appointmentType !== undefined &&
            dto.appointmentType !== currentExisting.appointmentType);

        // Hủy các appointment bị ảnh hưởng
        // Xử lý do dayOfWeek/time/type thay đổi và effective range thu hẹp
        {
          const checkDate = new Date(tomorrow);
          // Giới hạn check đến max(oldRangeEnd, newRangeEnd) để bắt cả vùng bị cắt
          const oldEffectiveUntil = currentExisting.effectiveUntil;
          const checkRangeEnd =
            oldEffectiveUntil && oldEffectiveUntil < maxWindow
              ? startOfDayVN(oldEffectiveUntil)
              : maxWindow;

          while (checkDate <= checkRangeEnd) {
            const matchesOldDay =
              getDayVN(checkDate) === currentExisting.dayOfWeek;
            const matchesNewDay = getDayVN(checkDate) === currentNewDayOfWeek;

            if (!matchesOldDay && !matchesNewDay) {
              checkDate.setDate(checkDate.getDate() + 1);
              continue;
            }

            const dayStart = startOfDayVN(checkDate);
            const dayEnd = endOfDayVN(checkDate);

            const dayAppointments = await manager.find(Appointment, {
              where: {
                doctorId: currentExisting.doctorId,
                scheduledAt: Between(dayStart, dayEnd),
                status: In([
                  AppointmentStatusEnum.CONFIRMED,
                  AppointmentStatusEnum.PENDING_PAYMENT,
                  AppointmentStatusEnum.PENDING,
                ]),
              },
              relations: ['timeSlot', 'timeSlot.schedule'],
            });

            for (const apt of dayAppointments) {
              // Chỉ xử lý appointment thuộc schedule này
              if (apt.timeSlot?.scheduleId !== id) continue;

              let shouldCancel = false;

              // Case 1: Tắt lịch hoặc nằm ngoài effective range mới -> cancel
              if (currentNewIsAvailable === false) {
                shouldCancel = true;
              }
              if (
                !shouldCancel &&
                currentNewEffectiveFrom &&
                apt.scheduledAt < startOfDayVN(currentNewEffectiveFrom)
              ) {
                shouldCancel = true;
              }
              if (
                !shouldCancel &&
                currentNewEffectiveUntil &&
                apt.scheduledAt > endOfDayVN(currentNewEffectiveUntil)
              ) {
                shouldCancel = true;
              }

              // Case 2: Weekday changed
              if (!shouldCancel && hasCriticalChanges) {
                if (
                  dto.dayOfWeek !== undefined &&
                  dto.dayOfWeek !== currentExisting.dayOfWeek
                ) {
                  if (matchesOldDay && !matchesNewDay) {
                    shouldCancel = true;
                  }
                }

                // Case 3: Time range changed
                if (!shouldCancel && matchesNewDay) {
                  const [newStartH, newStartM] = currentNewStartTime
                    .split(':')
                    .map(Number);
                  const [newEndH, newEndM] = currentNewEndTime
                    .split(':')
                    .map(Number);

                  if (!apt.timeSlot?.schedule?.slotDuration) continue;

                  const newScheduleStart = new Date(
                    checkDate.getTime() + (newStartH * 60 + newStartM) * 60000,
                  );
                  const newScheduleEnd = new Date(
                    checkDate.getTime() + (newEndH * 60 + newEndM) * 60000,
                  );

                  const aptEnd = new Date(
                    apt.scheduledAt.getTime() +
                      apt.timeSlot.schedule.slotDuration * 60 * 1000,
                  );

                  if (
                    apt.scheduledAt < newScheduleStart ||
                    aptEnd > newScheduleEnd
                  ) {
                    shouldCancel = true;
                  }
                }

                // Case 4: Appointment Type changed
                if (
                  !shouldCancel &&
                  dto.appointmentType &&
                  apt.appointmentType !== currentNewAppointmentType
                ) {
                  shouldCancel = true;
                }
              }

              if (shouldCancel) {
                cancellationEffects.push(
                  await this.appointmentCancellationCore.cancelAppointmentInTransaction(
                    manager,
                    {
                      appointment: apt,
                      reason: 'SCHEDULE_CHANGE',
                      cancelledBy: 'DOCTOR',
                      paymentCancellationReason: 'SCHEDULE_CHANGE',
                      slotAction: 'soft_delete',
                    },
                  ),
                );
                cancelledAppointments.push(apt);
              }
            }

            checkDate.setDate(checkDate.getDate() + 1);
          }
        }

        // Xóa slots cũ
        // Xóa toàn bộ slots trống từ tomorrow đến max(oldEnd, newEnd)
        // để generate lại sạch theo range mới
        const oldEffectiveUntil = currentExisting.effectiveUntil;
        const deleteRangeEnd =
          oldEffectiveUntil && oldEffectiveUntil < maxWindow
            ? endOfDayVN(oldEffectiveUntil)
            : endOfDayVN(maxWindow);

        const deleteQuery = manager
          .createQueryBuilder()
          .softDelete()
          .from(TimeSlot)
          .where('"schedule_id" = :scheduleId', { scheduleId: id })
          .andWhere('"start_time" >= :tomorrow', { tomorrow })
          .andWhere('"start_time" <= :deleteRangeEnd', { deleteRangeEnd })
          .andWhere('"booked_count" = 0');

        if (
          dto.dayOfWeek !== undefined &&
          dto.dayOfWeek !== currentExisting.dayOfWeek
        ) {
          deleteQuery.andWhere(
            `EXTRACT(DOW FROM "start_time" AT TIME ZONE 'Asia/Ho_Chi_Minh') = :dow`,
            { dow: currentExisting.dayOfWeek },
          );
        }

        await deleteQuery.execute();

        // Update schedule
        await manager.update(DoctorSchedule, id, {
          dayOfWeek: currentNewDayOfWeek,
          startTime: currentNewStartTime,
          endTime: currentNewEndTime,
          slotDuration: currentNewSlotDuration,
          slotCapacity: currentNewSlotCapacity,
          appointmentType: currentNewAppointmentType,
          consultationFee:
            dto.consultationFee !== undefined
              ? (dto.consultationFee?.toString() ?? null)
              : currentExisting.consultationFee,
          discountPercent:
            dto.discountPercent ?? currentExisting.discountPercent,
          minimumBookingTime:
            dto.minimumBookingDays !== undefined
              ? dto.minimumBookingDays * 24 * 60
              : currentExisting.minimumBookingTime,
          maxAdvanceBookingDays:
            dto.maxAdvanceBookingDays ?? currentExisting.maxAdvanceBookingDays,
          isAvailable: currentNewIsAvailable,
          effectiveFrom: currentNewEffectiveFrom,
          effectiveUntil: currentNewEffectiveUntil,
        });

        const updatedSchedule = await manager.findOne(DoctorSchedule, {
          where: { id },
        });

        // Generate slots mới
        let totalGeneratedSlots = 0;
        const skippedDaysByHigherPriority = 0;

        if (currentNewIsAvailable === false) {
          this.logger.log(
            `Schedule ${id} is disabled, skipping slot generation`,
          );
          return {
            schedule: updatedSchedule!,
            generatedSlots: 0,
            skippedDaysByHigherPriority: 0,
            cancelledAppointments,
            cancellationEffects,
          };
        }

        totalGeneratedSlots = await this.slotService.generateSlotsForSchedule(
          updatedSchedule!,
          currentActualRangeStart,
          currentActualRangeEnd,
          manager,
        );

        const updated = await manager.findOne(DoctorSchedule, {
          where: { id },
        });

        return {
          schedule: updated!,
          generatedSlots: totalGeneratedSlots,
          skippedDaysByHigherPriority,
          cancelledAppointments,
          cancellationEffects,
        };
      },
    );

    this.appointmentCancellationCore.schedulePostCommitEffects(
      result.cancellationEffects,
    );
    if (result.cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(
          result.cancelledAppointments,
          'SCHEDULE_CHANGE',
        )
        .catch((err) => {
          const appointmentIds = result.cancelledAppointments
            .map((a) => a.id)
            .join(',');
          this.logger.error(
            `Failed to send notifications for ${result.cancelledAppointments.length} appointments (doctorId=${existing.doctorId}, appointmentIds=${appointmentIds})`,
            err instanceof Error ? err.stack : String(err),
          );
        });
    }

    let message = `Cập nhật lịch cố định thành công. Thay đổi áp dụng từ ngày ${tomorrow.toLocaleDateString(
      'vi-VN',
    )}.`;

    if (result.cancelledAppointments.length > 0) {
      message += ` Đã hủy ${result.cancelledAppointments.length} lịch hẹn bị ảnh hưởng.`;
    }

    message += ` Đã tạo ${result.generatedSlots} time slots mới.`;

    if (result.skippedDaysByHigherPriority > 0) {
      message += ` (${result.skippedDaysByHigherPriority} ngày bị bỏ qua do có lịch ưu tiên cao hơn)`;
    }

    return new ResponseCommon(200, message, {
      schedule: result.schedule,
      generatedSlots: result.generatedSlots,
      cancelledCount: result.cancelledAppointments.length,
    });
  }

  // ==================== EFFECTIVE DATE HELPERS ====================

  /**
   * Thu hẹp effective range -> cancel appointments + xóa slots ngoài range mới.
   * Cases: effectiveFrom dời muộn hơn, effectiveUntil dời sớm hơn.
   */
  private async _handleEffectiveShrink(
    schedule: DoctorSchedule,
    newFrom: Date | null,
    newUntil: Date | null,
    manager: EntityManager,
    cancellationEffects: AppointmentCancellationPostCommitEffect[],
  ): Promise<Appointment[]> {
    const now = vnNow();
    const tomorrow = addDaysVN(startOfDayVN(now), 1);
    const horizonExclusiveEnd = addDaysVN(startOfDayVN(now), 31);
    const cancelled: Appointment[] = [];

    const oldFrom = schedule.effectiveFrom
      ? startOfDayVN(schedule.effectiveFrom)
      : null;
    const oldUntil = schedule.effectiveUntil
      ? startOfDayVN(schedule.effectiveUntil)
      : null;

    // Cắt đầu: effectiveFrom dời muộn hơn (null->date hoặc date->date muộn hơn)
    if (newFrom !== null) {
      const normalizedNewFrom = startOfDayVN(newFrom);
      const isShrinkingHead = oldFrom === null || normalizedNewFrom > oldFrom;

      if (isShrinkingHead) {
        const cutStart =
          oldFrom === null ? tomorrow : oldFrom > tomorrow ? oldFrom : tomorrow;
        const cutEnd = normalizedNewFrom;

        if (cutStart < cutEnd) {
          await this._cancelAndDeleteRange(
            schedule,
            cutStart,
            cutEnd,
            manager,
            cancelled,
            cancellationEffects,
          );
        }
      }
    }

    // Cắt cuối: effectiveUntil dời sớm hơn (null->date hoặc date->date sớm hơn)
    if (newUntil !== null) {
      const normalizedNewUntil = startOfDayVN(newUntil);
      const isShrinkingTail =
        oldUntil === null || normalizedNewUntil < oldUntil;

      if (isShrinkingTail) {
        const trimStartCandidate = addDaysVN(normalizedNewUntil, 1);
        const trimStart =
          trimStartCandidate > tomorrow ? trimStartCandidate : tomorrow;
        const trimEnd = oldUntil ? addDaysVN(oldUntil, 1) : horizonExclusiveEnd;

        if (trimStart < trimEnd) {
          await this._cancelAndDeleteRange(
            schedule,
            trimStart,
            trimEnd,
            manager,
            cancelled,
            cancellationEffects,
          );
        }
      }
    }

    return cancelled;
  }

  /**
   * Mở rộng effective range -> generate thêm slots cho vùng mới mở.
   * Cases: effectiveFrom dời sớm hơn / về null, effectiveUntil dời trễ hơn / về null.
   */
  private async _handleEffectiveExpand(
    schedule: DoctorSchedule,
    newFrom: Date | null,
    newUntil: Date | null,
    manager: EntityManager,
  ): Promise<number> {
    const now = vnNow();
    const tomorrow = addDaysVN(startOfDayVN(now), 1);
    const maxWindow = addDaysVN(startOfDayVN(now), 30);
    let totalGenerated = 0;

    const oldFrom = schedule.effectiveFrom
      ? startOfDayVN(schedule.effectiveFrom)
      : null;
    const oldUntil = schedule.effectiveUntil
      ? startOfDayVN(schedule.effectiveUntil)
      : null;

    // Mở đầu: effectiveFrom dời sớm hơn hoặc về null
    const isExpandingHead =
      newFrom === null
        ? oldFrom !== null
        : oldFrom !== null && newFrom < oldFrom;

    if (isExpandingHead) {
      const expandStart =
        newFrom === null
          ? tomorrow
          : startOfDayVN(newFrom) > tomorrow
            ? startOfDayVN(newFrom)
            : tomorrow;
      const expandEnd = addDaysVN(oldFrom!, -1);

      if (expandStart <= expandEnd && expandStart <= maxWindow) {
        const actualEnd = expandEnd < maxWindow ? expandEnd : maxWindow;
        totalGenerated += await this._generateSlotsInRange(
          schedule,
          expandStart,
          actualEnd,
          manager,
        );
      }
    }

    // Mở cuối: effectiveUntil dời trễ hơn hoặc về null
    const isExpandingTail =
      newUntil === null
        ? oldUntil !== null
        : oldUntil !== null && newUntil > oldUntil;

    if (isExpandingTail) {
      const expandStartCandidate = addDaysVN(oldUntil!, 1);
      const expandStart =
        expandStartCandidate > tomorrow ? expandStartCandidate : tomorrow;
      const expandEnd =
        newUntil === null
          ? maxWindow
          : startOfDayVN(newUntil) < maxWindow
            ? startOfDayVN(newUntil)
            : maxWindow;

      if (expandStart <= expandEnd) {
        totalGenerated += await this._generateSlotsInRange(
          schedule,
          expandStart,
          expandEnd,
          manager,
        );
      }
    }

    return totalGenerated;
  }

  /**
   * Cancel appointments + soft delete slots trống trong [rangeStart, rangeEnd).
   * Chỉ xử lý appointments thuộc đúng schedule này (filter theo scheduleId qua timeSlot).
   */
  private async _cancelAndDeleteRange(
    schedule: DoctorSchedule,
    rangeStart: Date,
    rangeEnd: Date,
    manager: EntityManager,
    cancelledList: Appointment[],
    cancellationEffects: AppointmentCancellationPostCommitEffect[],
  ): Promise<void> {
    const [sH, sM] = schedule.startTime.split(':').map(Number);
    const [eH, eM] = schedule.endTime.split(':').map(Number);
    const schedStartMin = sH * 60 + sM;
    const schedEndMin = eH * 60 + eM;

    const appointments = await manager
      .createQueryBuilder(Appointment, 'appointment')
      .leftJoinAndSelect('appointment.timeSlot', 'timeSlot')
      .leftJoinAndSelect('timeSlot.schedule', 'schedule')
      .where('appointment.doctorId = :doctorId', {
        doctorId: schedule.doctorId,
      })
      .andWhere('appointment.scheduledAt >= :rangeStart', { rangeStart })
      .andWhere('appointment.scheduledAt < :rangeEnd', { rangeEnd })
      .andWhere('appointment.status IN (:...statuses)', {
        statuses: [
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
          AppointmentStatusEnum.PENDING,
        ],
      })
      .getMany();

    for (const apt of appointments) {
      if (getDayVN(apt.scheduledAt) !== schedule.dayOfWeek) continue;
      const aptMin = getTimeMinutesVN(apt.scheduledAt);
      if (aptMin < schedStartMin || aptMin >= schedEndMin) continue;
      // Chỉ cancel appointment thuộc đúng schedule này
      if (apt.timeSlot?.scheduleId !== schedule.id) continue;

      cancellationEffects.push(
        await this.appointmentCancellationCore.cancelAppointmentInTransaction(
          manager,
          {
            appointment: apt,
            reason: 'SCHEDULE_CHANGE',
            cancelledBy: 'DOCTOR',
            paymentCancellationReason: 'SCHEDULE_CHANGE',
            slotAction: 'soft_delete',
          },
        ),
      );
      cancelledList.push(apt);
    }

    // Xóa toàn bộ slots trống của schedule trong range
    await manager
      .createQueryBuilder()
      .softDelete()
      .from(TimeSlot)
      .where('"schedule_id" = :scheduleId', { scheduleId: schedule.id })
      .andWhere('"start_time" >= :rangeStart', { rangeStart })
      .andWhere('"start_time" < :rangeEnd', { rangeEnd })
      .andWhere('"booked_count" = 0')
      .execute();
  }

  /**
   * Generate slots cho schedule trong [rangeStart, rangeEnd],
   * chỉ những ngày khớp dayOfWeek và không có higher-priority schedule.
   */
  private async _generateSlotsInRange(
    schedule: DoctorSchedule,
    rangeStart: Date,
    rangeEnd: Date,
    manager: EntityManager,
  ): Promise<number> {
    return this.slotService.generateSlotsForSchedule(
      schedule,
      rangeStart,
      rangeEnd,
      manager,
    );
  }

  // ==================== DELETE ====================

  async deleteRegular(
    doctorId: string,
    id: string,
  ): Promise<
    ResponseCommon<{
      cancelledAppointments: number;
      deletedSlots: number;
    }>
  > {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, doctorId },
    });
    if (!schedule) {
      this.logger.error('Schedule not found or unauthorized');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    if (schedule.scheduleType !== ScheduleType.REGULAR) {
      this.logger.error('Invalid schedule type');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const now = startOfDayVN(vnNow());

    const result = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const cancellationEffects: AppointmentCancellationPostCommitEffect[] =
          [];
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

        const [scheduleStartH, scheduleStartM] = schedule.startTime
          .split(':')
          .map(Number);
        const [scheduleEndH, scheduleEndM] = schedule.endTime
          .split(':')
          .map(Number);

        // Lấy danh sách ngày có FLEXIBLE
        const flexibleDates = await manager
          .createQueryBuilder(DoctorSchedule, 'ds')
          .select('ds.specificDate')
          .where('ds.doctorId = :doctorId', { doctorId: schedule.doctorId })
          .andWhere('ds.scheduleType IN (:...types)', {
            types: [ScheduleType.FLEXIBLE, ScheduleType.TIME_OFF],
          })
          .andWhere('ds.specificDate >= :now', { now })
          .getMany();

        const flexibleDateSet = new Set(
          flexibleDates.map(
            (d) => new Date(d.specificDate!).toISOString().split('T')[0],
          ),
        );

        const appointmentsToCancel = futureAppointments.filter((apt) => {
          const aptDate = apt.scheduledAt;
          // Bỏ qua nếu ngày đó có FLEXIBLE
          if (flexibleDateSet.has(formatDateVN(aptDate))) return false;
          if (getDayVN(aptDate) !== schedule.dayOfWeek) return false;
          if (apt.timeSlot?.scheduleId !== schedule.id) return false;

          if (
            schedule.effectiveFrom &&
            aptDate < startOfDayVN(schedule.effectiveFrom)
          )
            return false;
          if (
            schedule.effectiveUntil &&
            aptDate > endOfDayVN(schedule.effectiveUntil)
          )
            return false;

          const aptTime = getTimeMinutesVN(aptDate);
          const scheduleStartTime = scheduleStartH * 60 + scheduleStartM;
          const scheduleEndTime = scheduleEndH * 60 + scheduleEndM;

          return aptTime >= scheduleStartTime && aptTime < scheduleEndTime;
        });

        for (const apt of appointmentsToCancel) {
          cancellationEffects.push(
            await this.appointmentCancellationCore.cancelAppointmentInTransaction(
              manager,
              {
                appointment: apt,
                reason: 'SCHEDULE_DELETED',
                cancelledBy: 'DOCTOR',
                paymentCancellationReason: 'SCHEDULE_DELETED',
                slotAction: 'soft_delete',
              },
            ),
          );
        }

        const deleteResult = await manager
          .createQueryBuilder()
          .softDelete()
          .from(TimeSlot)
          .where('"schedule_id" = :scheduleId', { scheduleId: id })
          .andWhere('"start_time" >= :now', { now })
          .andWhere('"booked_count" = 0')
          .execute();

        await manager.remove(schedule);

        return {
          cancelledAppointments: appointmentsToCancel.length,
          deletedSlots: deleteResult.affected || 0,
          appointmentsList: appointmentsToCancel,
          cancellationEffects,
        };
      },
    );

    this.appointmentCancellationCore.schedulePostCommitEffects(
      result.cancellationEffects,
    );
    if (result.appointmentsList.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(result.appointmentsList, 'SCHEDULE_CHANGE')
        .catch((err) => {
          const appointmentIds = result.appointmentsList
            .map((a) => a.id)
            .join(',');
          this.logger.error(
            `Failed to send notifications for ${result.appointmentsList.length} appointments (doctorId=${schedule.doctorId}, appointmentIds=${appointmentIds})`,
            err instanceof Error ? err.stack : String(err),
          );
        });
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
}
