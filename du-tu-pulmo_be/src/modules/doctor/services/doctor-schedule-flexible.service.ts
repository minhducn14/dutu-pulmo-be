import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, In, Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import {
  AppointmentCancellationCoreService,
  AppointmentCancellationPostCommitEffect,
} from '@/modules/appointment/services/appointment-cancellation-core.service';
import {
  CreateFlexibleScheduleDto,
  UpdateFlexibleScheduleDto,
} from '@/modules/doctor/dto/flexible-schedule.dto';
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
import { DoctorScheduleQueryService } from '@/modules/doctor/services/doctor-schedule-query.service';
import { DoctorScheduleUpdateService } from '@/modules/doctor/services/doctor-schedule-update.service';
import { DoctorScheduleRestoreService } from '@/modules/doctor/services/doctor-schedule-restore.service';
import { endOfDayVN, getDayVN, startOfDayVN, vnNow } from '@/common/datetime';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

@Injectable()
export class DoctorScheduleFlexibleService {
  private readonly logger = new Logger(DoctorScheduleFlexibleService.name);
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly helper: DoctorScheduleHelperService,
    private readonly queryService: DoctorScheduleQueryService,
    private readonly updateService: DoctorScheduleUpdateService,
    private readonly restoreService: DoctorScheduleRestoreService,
    private readonly appointmentCancellationCore: AppointmentCancellationCoreService,
  ) {}

  // ==================== CREATE ====================

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
    const specificDateNormalized = startOfDayVN(specificDate);
    const dayOfWeek = getDayVN(specificDateNormalized);
    const priority = SCHEDULE_TYPE_PRIORITY[ScheduleType.FLEXIBLE];

    const minDays = dto.minimumBookingDays ?? 0;
    const maxDays = dto.maxAdvanceBookingDays ?? 30;
    this.helper.validateBookingDaysConstraints(minDays, maxDays);
    this.helper.validateMergedTimeRange(
      dto.startTime,
      dto.endTime,
      dto.slotDuration,
    );

    if (dto.startTime >= dto.endTime) {
      this.logger.error('Invalid start time or end time');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const today = startOfDayVN(vnNow());
    if (specificDateNormalized < today) {
      this.logger.error('Specific date is in the past');
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

    if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (!doctor.primaryHospitalId) {
        this.logger.error('Doctor does not have a primary hospital');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    const existingFlexibleSameDay = await this.dataSource
      .getRepository(DoctorSchedule)
      .findOne({
        where: {
          doctorId,
          scheduleType: ScheduleType.FLEXIBLE,
          specificDate: specificDateNormalized,
        },
        select: ['id'],
      });
    if (existingFlexibleSameDay) {
      this.logger.error(
        `Doctor ${doctorId} already has a flexible schedule on ${dto.specificDate}`,
      );
      throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
    }

    await this.helper.checkOverlap(
      doctorId,
      dayOfWeek,
      dto.startTime,
      dto.endTime,
      specificDateNormalized,
      specificDateNormalized,
      priority,
    );

    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    const baseDate = specificDateNormalized;

    const scheduleStart = new Date(
      baseDate.getTime() + (startH * 60 + startM) * 60000,
    );
    const scheduleEnd = new Date(
      baseDate.getTime() + (endH * 60 + endM) * 60000,
    );

    const result = await this.dataSource.transaction(async (manager) => {
      const startOfDay = startOfDayVN(specificDateNormalized);
      const endOfDay = endOfDayVN(specificDateNormalized);

      const appointments = await manager.find(Appointment, {
        where: {
          doctorId,
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

      const cancellationEffects: AppointmentCancellationPostCommitEffect[] = [];

      // Business rule: creating FLEXIBLE on a date cancels all pre-booked appointments on that date.
      const conflicting = appointments;

      for (const apt of conflicting) {
        cancellationEffects.push(
          await this.appointmentCancellationCore.cancelAppointmentInTransaction(
            manager,
            {
              appointment: apt,
              reason: 'SCHEDULE_CHANGE',
              cancelledBy: 'SYSTEM',
              paymentCancellationReason: 'SCHEDULE_CHANGE',
              slotAction: 'soft_delete',
            },
          ),
        );
      }

      const schedule = manager.create(DoctorSchedule, {
        doctorId,
        scheduleType: ScheduleType.FLEXIBLE,
        priority,
        dayOfWeek,
        specificDate: specificDateNormalized,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotCapacity: dto.slotCapacity,
        slotDuration: dto.slotDuration,
        appointmentType: dto.appointmentType,
        minimumBookingTime: (dto.minimumBookingDays ?? 0) * 24 * 60,
        maxAdvanceBookingDays: dto.maxAdvanceBookingDays ?? 30,
        consultationFee: dto.consultationFee?.toString() ?? null,
        discountPercent: dto.discountPercent ?? 0,
        isAvailable: dto.isAvailable ?? true,
        effectiveFrom: specificDateNormalized,
        effectiveUntil: specificDateNormalized,
      });

      const savedSchedule = await manager.save(schedule);
      await this.reconcileFlexibleWinnerDay(
        manager,
        doctorId,
        specificDateNormalized,
        savedSchedule.id,
      );

      const existingSlots = await manager
        .createQueryBuilder(TimeSlot, 'slot')
        .where('slot.doctorId = :doctorId', { doctorId })
        .andWhere('slot.startTime < :scheduleEnd', { scheduleEnd })
        .andWhere('slot.endTime > :scheduleStart', { scheduleStart })
        .getMany();
      const timeOffPeriods = await this.getTimeOffPeriods(
        manager,
        doctorId,
        specificDateNormalized,
      );

      const slotDurationMs = dto.slotDuration * 60 * 1000;
      let currentStart = new Date(scheduleStart);
      const slotEntities: TimeSlot[] = [];

      while (currentStart < scheduleEnd) {
        const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
        if (slotEnd > scheduleEnd) break;

        if (this.overlapsTimeOffPeriod(currentStart, slotEnd, timeOffPeriods)) {
          currentStart = slotEnd;
          continue;
        }

        const hasOverlap = existingSlots.some(
          (existingSlot) =>
            currentStart < existingSlot.endTime &&
            slotEnd > existingSlot.startTime,
        );

        if (!hasOverlap) {
          const slot = manager.create(TimeSlot, {
            doctorId: savedSchedule.doctorId,
            scheduleId: savedSchedule.id,
            scheduleVersion: savedSchedule.version,
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
        cancellationEffects,
      };
    });

    this.appointmentCancellationCore.schedulePostCommitEffects(
      result.cancellationEffects,
    );
    this.sendFlexibleScheduleNotifications(
      result.cancelledAppointments,
      doctorId,
    );

    const message =
      result.cancelledAppointments.length > 0
        ? `Tạo lịch làm việc linh hoạt thành công. ${result.cancelledAppointments.length} lịch hẹn NGOÀI khung giờ mới đã bị hủy. Đã tạo ${result.generatedSlotsCount} time slots.`
        : `Tạo lịch làm việc linh hoạt thành công. Đã tạo ${result.generatedSlotsCount} time slots.`;

    return new ResponseCommon(201, message, {
      ...result.schedule,
      cancelledAppointments: result.cancelledAppointments.length,
      generatedSlots: result.generatedSlotsCount,
    });
  }

  // ==================== UPDATE ====================

  async updateFlexibleSchedule(
    doctorId: string,
    id: string,
    dto: UpdateFlexibleScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existing = await this.queryService.validateDoctorOwnership(
      id,
      doctorId,
    );

    if (existing.scheduleType !== ScheduleType.FLEXIBLE) {
      this.logger.error('Schedule is not flexible');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const timeChanged =
      (dto.startTime && dto.startTime !== existing.startTime) ||
      (dto.endTime && dto.endTime !== existing.endTime) ||
      (dto.slotDuration !== undefined &&
        dto.slotDuration !== existing.slotDuration) ||
      (dto.slotCapacity !== undefined &&
        dto.slotCapacity !== existing.slotCapacity) ||
      (dto.appointmentType !== undefined &&
        dto.appointmentType !== existing.appointmentType);

    const isAvailableToggled =
      dto.isAvailable !== undefined && dto.isAvailable !== existing.isAvailable;

    if (timeChanged || isAvailableToggled) {
      return this.updateFlexibleScheduleWithSlotSync(id, dto, existing);
    }

    const updateDto: UpdateDoctorScheduleDto = {
      id,
      slotCapacity: dto.slotCapacity,
      slotDuration: dto.slotDuration,
      appointmentType: dto.appointmentType,
      consultationFee: dto.consultationFee,
      discountPercent: dto.discountPercent,
      minimumBookingDays: dto.minimumBookingDays,
      maxAdvanceBookingDays: dto.maxAdvanceBookingDays,
      isAvailable: dto.isAvailable,
    };

    return this.updateService.updateScheduleInternal(id, updateDto);
  }

  private async updateFlexibleScheduleWithSlotSync(
    id: string,
    dto: UpdateFlexibleScheduleDto,
    existing: DoctorSchedule,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    if (!existing.specificDate) {
      this.logger.error('Schedule does not have a specific date');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const specificDate = new Date(existing.specificDate);
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    const existingMinimumBookingDays = Math.floor(
      (existing.minimumBookingTime ?? 0) / (24 * 60),
    );
    const newMinimumBookingDays =
      dto.minimumBookingDays ?? existingMinimumBookingDays;
    const newMaxAdvanceBookingDays =
      dto.maxAdvanceBookingDays ?? existing.maxAdvanceBookingDays;
    const newAppointmentType = dto.appointmentType ?? existing.appointmentType;

    this.helper.validateBookingDaysConstraints(
      newMinimumBookingDays,
      newMaxAdvanceBookingDays,
    );
    this.helper.validateMergedTimeRange(
      newStartTime,
      newEndTime,
      dto.slotDuration ?? existing.slotDuration,
    );

    if (newStartTime >= newEndTime) {
      this.logger.error('Invalid start time or end time');
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

    const [startH, startM] = newStartTime.split(':').map(Number);
    const [endH, endM] = newEndTime.split(':').map(Number);

    const baseDate = startOfDayVN(specificDate);

    const scheduleStart = new Date(
      baseDate.getTime() + (startH * 60 + startM) * 60000,
    );
    const scheduleEnd = new Date(
      baseDate.getTime() + (endH * 60 + endM) * 60000,
    );

    const result = await this.dataSource.transaction(async (manager) => {
      // Xóa slot chưa có booking thuộc lịch này
      await manager
        .createQueryBuilder()
        .softDelete()
        .from(TimeSlot)
        .where('scheduleId = :scheduleId', { scheduleId: id })
        .andWhere('bookedCount = 0')
        .execute();

      const startOfDay = startOfDayVN(specificDate);
      const endOfDay = endOfDayVN(specificDate);

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

      const cancellationEffects: AppointmentCancellationPostCommitEffect[] = [];
      const newIsAvailable = dto.isAvailable ?? existing.isAvailable;

      // Tìm appointment bị ảnh hưởng (ngoài khung giờ mới HOẶC do bị tắt lịch)
      // Business rule: updating FLEXIBLE on a date also cancels all pre-booked appointments on that date.
      const appointmentsToCancel = appointments;

      for (const apt of appointmentsToCancel) {
        cancellationEffects.push(
          await this.appointmentCancellationCore.cancelAppointmentInTransaction(
            manager,
            {
              appointment: apt,
              reason: 'SCHEDULE_CHANGE',
              cancelledBy: 'SYSTEM',
              paymentCancellationReason: 'SCHEDULE_CHANGE',
              slotAction: 'soft_delete',
              additionalUpdates: {
                conflict: false,
                conflictReason: null,
              },
            },
          ),
        );
      }

      // Xóa slot không có booking trong khoảng mới
      const slotCapacity = dto.slotCapacity ?? existing.slotCapacity;
      const slotDuration = dto.slotDuration ?? existing.slotDuration;
      const appointmentType = newAppointmentType;

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
        discountPercent: dto.discountPercent ?? existing.discountPercent,
        minimumBookingTime:
          dto.minimumBookingDays !== undefined
            ? dto.minimumBookingDays * 24 * 60
            : existing.minimumBookingTime,
        maxAdvanceBookingDays:
          dto.maxAdvanceBookingDays ?? existing.maxAdvanceBookingDays,
        isAvailable: dto.isAvailable ?? existing.isAvailable,
      });

      const updatedSchedule = await manager.findOne(DoctorSchedule, {
        where: { id },
      });

      if (newIsAvailable === false) {
        const restoredSlots = await this.restoreService.restoreSlots(
          manager,
          existing.doctorId,
          specificDate,
          startOfDay,
          endOfDay,
        );
        this.logger.log(
          `Flexible Schedule ${id} is disabled, restoring base day schedule`,
        );
        return {
          schedule: updatedSchedule!,
          cancelledAppointments: appointmentsToCancel,
          generatedSlots: restoredSlots,
          cancellationEffects,
        };
      }

      await this.reconcileFlexibleWinnerDay(
        manager,
        existing.doctorId,
        specificDate,
        id,
      );

      const existingSlots = await manager
        .createQueryBuilder(TimeSlot, 'slot')
        .where('slot.doctorId = :doctorId', { doctorId: existing.doctorId })
        .andWhere('slot.startTime < :scheduleEnd', { scheduleEnd })
        .andWhere('slot.endTime > :scheduleStart', { scheduleStart })
        .getMany();
      const timeOffPeriods = await this.getTimeOffPeriods(
        manager,
        existing.doctorId,
        specificDate,
      );

      const slotDurationMs = slotDuration * 60 * 1000;
      let currentStart = new Date(scheduleStart);
      const slotEntities: TimeSlot[] = [];

      while (currentStart < scheduleEnd) {
        const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
        if (slotEnd > scheduleEnd) break;

        if (this.overlapsTimeOffPeriod(currentStart, slotEnd, timeOffPeriods)) {
          currentStart = slotEnd;
          continue;
        }

        const hasOverlap = existingSlots.some(
          (existingSlot) =>
            currentStart < existingSlot.endTime &&
            slotEnd > existingSlot.startTime,
        );

        if (!hasOverlap) {
          const slot = manager.create(TimeSlot, {
            doctorId: existing.doctorId,
            scheduleId: id,
            scheduleVersion: updatedSchedule!.version,
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

      const updated = await manager.findOne(DoctorSchedule, { where: { id } });

      return {
        schedule: updated!,
        cancelledAppointments: appointmentsToCancel,
        generatedSlots: slotEntities.length,
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

    let message = `Cập nhật lịch thành công.`;
    if (result.cancelledAppointments.length > 0) {
      message += ` ${result.cancelledAppointments.length} lịch hẹn nằm ngoài khung giờ mới đã bị hủy và bệnh nhân đã được thông báo.`;
    }
    message += ` Đã tạo ${result.generatedSlots} time slots mới.`;

    return new ResponseCommon(200, message, result.schedule);
  }

  // ==================== DELETE ====================

  async deleteFlexibleSchedule(
    doctorId: string,
    id: string,
  ): Promise<
    ResponseCommon<{
      appointmentsCount: number;
      appointmentsOutsideRegular: number;
      deletedSlots: number;
      restoredSlots: number;
    }>
  > {
    const schedule = await this.queryService.validateDoctorOwnership(
      id,
      doctorId,
    );

    if (schedule.scheduleType !== ScheduleType.FLEXIBLE) {
      this.logger.error('Schedule is not flexible');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (!schedule.specificDate) {
      this.logger.error('Schedule does not have a specific date');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const specificDate = new Date(schedule.specificDate);
    const dayOfWeek = getDayVN(specificDate);

    const result = await this.dataSource.transaction(async (manager) => {
      const dayStart = startOfDayVN(specificDate);
      const dayEnd = endOfDayVN(specificDate);

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

      const regularSchedules = await manager.find(DoctorSchedule, {
        where: {
          doctorId: schedule.doctorId,
          dayOfWeek,
          scheduleType: ScheduleType.REGULAR,
          isAvailable: true,
        },
      });
      const timeOffPeriods = await this.getTimeOffPeriods(
        manager,
        schedule.doctorId,
        specificDate,
      );

      let appointmentsOutsideRegular = 0;
      for (const apt of dayAppointments) {
        if (!apt.timeSlot?.schedule?.slotDuration) {
          this.logger.warn(
            `Appointment ${apt.id} has no slotDuration — skipping regular coverage check`,
          );
          continue;
        }
        const aptEnd = new Date(
          apt.scheduledAt.getTime() +
            apt.timeSlot.schedule.slotDuration * 60 * 1000,
        );

        let isCoveredByRegular = false;
        for (const reg of regularSchedules) {
          const [regStartH, regStartM] = reg.startTime.split(':').map(Number);
          const [regEndH, regEndM] = reg.endTime.split(':').map(Number);

          const base = startOfDayVN(specificDate);

          const regStart = new Date(
            base.getTime() + (regStartH * 60 + regStartM) * 60000,
          );
          const regEnd = new Date(
            base.getTime() + (regEndH * 60 + regEndM) * 60000,
          );

          if (apt.scheduledAt >= regStart && aptEnd <= regEnd) {
            isCoveredByRegular = true;
            break;
          }
        }

        const overlapsTimeOff = this.overlapsTimeOffPeriod(
          apt.scheduledAt,
          aptEnd,
          timeOffPeriods,
        );

        if (!isCoveredByRegular || overlapsTimeOff) {
          appointmentsOutsideRegular++;
          apt.conflict = true;
          apt.conflictReason = overlapsTimeOff
            ? 'TIME_OFF'
            : 'OUTSIDE_REGULAR_SCHEDULE';
          await manager.save(apt);
        }
      }

      const deleteResult = await manager
        .createQueryBuilder()
        .softDelete()
        .from(TimeSlot)
        .where('scheduleId = :scheduleId', { scheduleId: id })
        .andWhere('bookedCount = 0')
        .execute();

      await manager.remove(schedule);

      const restoredSlots = await this.restoreService.restoreSlots(
        manager,
        schedule.doctorId,
        specificDate,
        dayStart,
        dayEnd,
      );

      return {
        appointmentsCount: dayAppointments.length,
        appointmentsOutsideRegular,
        deletedSlots: deleteResult.affected || 0,
        restoredSlots,
      };
    });

    let message = 'Xóa lịch linh hoạt thành công.';
    if (result.appointmentsCount > 0) {
      message += ` ${result.appointmentsCount} lịch hẹn được giữ nguyên.`;
      if (result.appointmentsOutsideRegular > 0) {
        message += ` ⚠️ CẢNH BÁO: ${result.appointmentsOutsideRegular} lịch hẹn nằm NGOÀI lịch cố định. Vui lòng kiểm tra và xử lý.`;
      }
    }
    if (result.deletedSlots > 0) {
      message += ` Đã xóa ${result.deletedSlots} time slots.`;
    }
    if (result.restoredSlots > 0) {
      message += ` Đã khôi phục ${result.restoredSlots} time slots từ lịch cố định.`;
    }

    return new ResponseCommon(200, message, {
      appointmentsCount: result.appointmentsCount,
      appointmentsOutsideRegular: result.appointmentsOutsideRegular,
      deletedSlots: result.deletedSlots,
      restoredSlots: result.restoredSlots,
    });
  }

  private async reconcileFlexibleWinnerDay(
    manager: EntityManager,
    doctorId: string,
    specificDate: Date,
    winnerScheduleId: string,
  ): Promise<void> {
    const dayStart = startOfDayVN(specificDate);
    const dayEnd = endOfDayVN(specificDate);

    await manager
      .createQueryBuilder()
      .softDelete()
      .from(TimeSlot)
      .where('doctorId = :doctorId', { doctorId })
      .andWhere('startTime >= :dayStart', { dayStart })
      .andWhere('startTime <= :dayEnd', { dayEnd })
      .andWhere('bookedCount = 0')
      .andWhere('"deleted_at" IS NULL')
      .andWhere('(scheduleId != :winnerScheduleId OR scheduleId IS NULL)', {
        winnerScheduleId,
      })
      .execute();

    await manager
      .createQueryBuilder()
      .update(TimeSlot)
      .set({ isAvailable: false })
      .where('doctorId = :doctorId', { doctorId })
      .andWhere('startTime >= :dayStart', { dayStart })
      .andWhere('startTime <= :dayEnd', { dayEnd })
      .andWhere('"deleted_at" IS NULL')
      .andWhere('isAvailable = true')
      .andWhere('(scheduleId != :winnerScheduleId OR scheduleId IS NULL)', {
        winnerScheduleId,
      })
      .execute();
  }

  private async getTimeOffPeriods(
    manager: EntityManager,
    doctorId: string,
    specificDate: Date,
  ): Promise<Array<{ start: Date; end: Date }>> {
    const dayStart = startOfDayVN(specificDate);
    const dayEnd = endOfDayVN(specificDate);
    const timeOffSchedules = await manager.find(DoctorSchedule, {
      where: {
        doctorId,
        scheduleType: ScheduleType.TIME_OFF,
        specificDate: Between(dayStart, dayEnd),
      },
    });

    const periods = timeOffSchedules
      .map((schedule) => {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);
        const baseDate = startOfDayVN(specificDate);

        return {
          start: new Date(baseDate.getTime() + (startH * 60 + startM) * 60000),
          end: new Date(baseDate.getTime() + (endH * 60 + endM) * 60000),
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged: Array<{ start: Date; end: Date }> = [];
    for (const period of periods) {
      const last = merged[merged.length - 1];
      if (!last || period.start > last.end) {
        merged.push(period);
        continue;
      }

      last.end = new Date(Math.max(last.end.getTime(), period.end.getTime()));
    }

    return merged;
  }

  private overlapsTimeOffPeriod(
    slotStart: Date,
    slotEnd: Date,
    timeOffPeriods: Array<{ start: Date; end: Date }>,
  ): boolean {
    return timeOffPeriods.some(
      (period) => slotStart < period.end && slotEnd > period.start,
    );
  }

  private sendFlexibleScheduleNotifications(
    cancelledAppointments: Appointment[],
    doctorId: string,
  ): void {
    if (cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(cancelledAppointments, 'SCHEDULE_CHANGE')
        .catch((err) => {
          const appointmentIds = cancelledAppointments
            .map((a) => a.id)
            .join(',');
          this.logger.error(
            `Failed to send notifications for ${cancelledAppointments.length} appointments (doctorId=${doctorId}, appointmentIds=${appointmentIds})`,
            err instanceof Error ? err.stack : String(err),
          );
        });
    }
  }
}
