import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import {
  AppointmentCancellationCoreService,
  AppointmentCancellationPostCommitEffect,
} from '@/modules/appointment/services/appointment-cancellation-core.service';
import {
  CreateTimeOffDto,
  UpdateTimeOffDto,
} from '@/modules/doctor/dto/time-off.dto';
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

@Injectable()
export class DoctorScheduleTimeOffService {
  private readonly logger = new Logger(DoctorScheduleTimeOffService.name);
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
    const priority = SCHEDULE_TYPE_PRIORITY[ScheduleType.TIME_OFF];

    if (dto.startTime >= dto.endTime) {
      this.logger.error('Invalid time range');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const today = startOfDayVN(vnNow());
    const specificDateNormalized = startOfDayVN(specificDate);
    const dayOfWeek = getDayVN(specificDateNormalized);

    if (specificDateNormalized < today) {
      this.logger.error('Specific date is in the past');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id'],
    });
    if (!doctor) {
      this.logger.error('Doctor not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    await this.helper.checkOverlap(
      doctorId,
      dayOfWeek,
      dto.startTime,
      dto.endTime,
      specificDate,
      specificDate,
      priority,
    );

    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    // Base date should be the normalized specific date
    const baseDate = startOfDayVN(specificDate);

    const scheduleStart = new Date(
      baseDate.getTime() + (startH * 60 + startM) * 60000,
    );
    const scheduleEnd = new Date(
      baseDate.getTime() + (endH * 60 + endM) * 60000,
    );

    const result = await this.dataSource.transaction(async (manager) => {
      const startOfDay = startOfDayVN(specificDate);
      const endOfDay = endOfDayVN(specificDate);

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
        const aptEnd = this.resolveAppointmentEnd(apt);
        if (!aptEnd) return false;
        return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
      });

      const cancellationEffects: AppointmentCancellationPostCommitEffect[] = [];
      for (const apt of conflicting) {
        cancellationEffects.push(
          await this.appointmentCancellationCore.cancelAppointmentInTransaction(
            manager,
            {
              appointment: apt,
              reason: 'TIME_OFF',
              cancelledBy: 'SYSTEM',
              paymentCancellationReason: 'TIME_OFF',
              slotAction: 'soft_delete',
            },
          ),
        );
      }

      const disableResult = await manager
        .createQueryBuilder()
        .update(TimeSlot)
        .set({ isAvailable: false })
        .where('doctorId = :doctorId', { doctorId })
        .andWhere('startTime < :scheduleEnd AND endTime > :scheduleStart', {
          scheduleStart,
          scheduleEnd,
        })
        .andWhere('bookedCount = 0')
        .execute();

      const schedule = manager.create(DoctorSchedule, {
        doctorId,
        scheduleType: ScheduleType.TIME_OFF,
        priority,
        dayOfWeek,
        specificDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        slotCapacity: 1,
        slotDuration: 30,
        appointmentType: AppointmentTypeEnum.VIDEO,
        isAvailable: false,
        note: dto.note ?? null,
        effectiveFrom: specificDate,
        effectiveUntil: specificDate,
      });

      const savedSchedule = await manager.save(schedule);

      return {
        schedule: savedSchedule,
        cancelledAppointments: conflicting,
        disabledSlotsCount: disableResult.affected || 0,
        cancellationEffects,
      };
    });

    this.appointmentCancellationCore.schedulePostCommitEffects(
      result.cancellationEffects,
    );
    if (result.cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(result.cancelledAppointments, 'TIME_OFF')
        .catch((err) => {
          const appointmentIds = result.cancelledAppointments
            .map((a) => a.id)
            .join(',');
          this.logger.error(
            `Failed to send notifications for ${result.cancelledAppointments.length} appointments (doctorId=${doctorId}, appointmentIds=${appointmentIds})`,
            err instanceof Error ? err.stack : String(err),
          );
        });
    }

    const message =
      result.cancelledAppointments.length > 0
        ? `Tạo lịch nghỉ thành công. ${result.cancelledAppointments.length} lịch hẹn đã được hủy. ${result.disabledSlotsCount} time slots đã được tắt.`
        : `Tạo lịch nghỉ thành công. ${result.disabledSlotsCount} time slots đã được tắt.`;

    return new ResponseCommon(201, message, {
      ...result.schedule,
      cancelledAppointments: result.cancelledAppointments.length,
      disabledSlots: result.disabledSlotsCount,
    } as any);
  }

  // ==================== UPDATE ====================

  async updateTimeOff(
    doctorId: string,
    id: string,
    dto: UpdateTimeOffDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existing = await this.queryService.validateDoctorOwnership(
      id,
      doctorId,
    );

    if (existing.scheduleType !== ScheduleType.TIME_OFF) {
      this.logger.error('Invalid schedule type');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const timeChanged =
      (dto.startTime && dto.startTime !== existing.startTime) ||
      (dto.endTime && dto.endTime !== existing.endTime);
    if (timeChanged) {
      return this.updateTimeOffWithSlotSync(id, dto, existing);
    }

    const updateDto: UpdateDoctorScheduleDto = {
      id,
      note: dto.note,
      isAvailable: dto.isAvailable,
    };

    return this.updateService.updateScheduleInternal(id, updateDto);
  }

  private async updateTimeOffWithSlotSync(
    id: string,
    dto: UpdateTimeOffDto,
    existing: DoctorSchedule,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    if (!existing.specificDate) {
      this.logger.error('Specific date not found');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const specificDate = new Date(existing.specificDate);

    const [oldStartH, oldStartM] = existing.startTime.split(':').map(Number);
    const [oldEndH, oldEndM] = existing.endTime.split(':').map(Number);

    const baseDate = startOfDayVN(specificDate);

    const oldScheduleStart = new Date(
      baseDate.getTime() + (oldStartH * 60 + oldStartM) * 60000,
    );
    const oldScheduleEnd = new Date(
      baseDate.getTime() + (oldEndH * 60 + oldEndM) * 60000,
    );

    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;
    if (newStartTime >= newEndTime) {
      this.logger.error('Invalid time range');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const [startH, startM] = newStartTime.split(':').map(Number);
    const [endH, endM] = newEndTime.split(':').map(Number);

    const scheduleStart = new Date(
      baseDate.getTime() + (startH * 60 + startM) * 60000,
    );
    const scheduleEnd = new Date(
      baseDate.getTime() + (endH * 60 + endM) * 60000,
    );

    const result = await this.dataSource.transaction(async (manager) => {
      const startOfDay = startOfDayVN(specificDate);
      const endOfDay = endOfDayVN(specificDate);

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

      const cancellationEffects: AppointmentCancellationPostCommitEffect[] = [];

      const cancelAppointmentsInRange = async (
        rangeStart: Date,
        rangeEnd: Date,
      ): Promise<Appointment[]> => {
        const conflicting = appointments.filter((apt) => {
          const aptEnd = this.resolveAppointmentEnd(apt);
          if (!aptEnd) return false;
          return apt.scheduledAt < rangeEnd && aptEnd > rangeStart;
        });

        for (const apt of conflicting) {
          cancellationEffects.push(
            await this.appointmentCancellationCore.cancelAppointmentInTransaction(
              manager,
              {
                appointment: apt,
                reason: 'TIME_OFF',
                cancelledBy: 'SYSTEM',
                paymentCancellationReason: 'TIME_OFF',
                slotAction: 'soft_delete',
              },
            ),
          );
        }

        return conflicting;
      };

      const cancelledIds = new Set<string>();

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

      const rangesToDisable: Array<{ start: Date; end: Date }> = [];

      if (scheduleStart < oldScheduleStart) {
        rangesToDisable.push({
          start: scheduleStart,
          end: oldScheduleStart,
        });
      }

      if (scheduleEnd > oldScheduleEnd) {
        rangesToDisable.push({
          start: oldScheduleEnd,
          end: scheduleEnd,
        });
      }

      let disabledSlots = 0;
      for (const range of rangesToDisable) {
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

        const disableResult = await manager
          .createQueryBuilder()
          .update(TimeSlot)
          .set({ isAvailable: false })
          .where('doctorId = :doctorId', { doctorId: existing.doctorId })
          .andWhere('startTime < :scheduleEnd AND endTime > :scheduleStart', {
            scheduleStart: range.start,
            scheduleEnd: range.end,
          })
          .andWhere('bookedCount = 0')
          .execute();
        disabledSlots += disableResult.affected || 0;
      }

      let restoredSlots = 0;
      let totalPreviouslyCancelled = 0;

      const rangesToRestore: Array<{ start: Date; end: Date }> = [];

      if (scheduleStart > oldScheduleStart) {
        rangesToRestore.push({
          start: oldScheduleStart,
          end: scheduleStart,
        });
      }

      if (scheduleEnd < oldScheduleEnd) {
        rangesToRestore.push({
          start: scheduleEnd,
          end: oldScheduleEnd,
        });
      }

      for (const range of rangesToRestore) {
        const restored = await this.restoreService.restoreSlots(
          manager,
          existing.doctorId,
          specificDate,
          range.start,
          range.end,
          {
            // During update, ignore the current TIME_OFF record (old range),
            // otherwise it blocks the exact range that should be restored.
            excludeTimeOffScheduleIds: [id],
          },
        );
        restoredSlots += restored;

        const previouslyCancelled = await manager.find(Appointment, {
          where: {
            doctorId: existing.doctorId,
            scheduledAt: Between(range.start, range.end),
            status: AppointmentStatusEnum.CANCELLED,
            cancellationReason: 'TIME_OFF',
          },
        });

        totalPreviouslyCancelled += previouslyCancelled.length;
      }

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
        previouslyCancelledCount: totalPreviouslyCancelled,
        cancellationEffects,
      } as {
        schedule: DoctorSchedule;
        cancelledAppointments: Appointment[];
        disabledSlots: number;
        restoredSlots: number;
        previouslyCancelledCount: number;
        cancellationEffects: AppointmentCancellationPostCommitEffect[];
      };
    });

    this.appointmentCancellationCore.schedulePostCommitEffects(
      result.cancellationEffects,
    );
    if (result.cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(result.cancelledAppointments, 'TIME_OFF')
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
    if (result.previouslyCancelledCount > 0) {
      message += ` ⚠️ LIÊN QUAN ĐẾN KHÔI PHỤC: ${result.previouslyCancelledCount} lịch hẹn đã bị hủy trước đó trong khoảng thời gian khôi phục sẽ KHÔNG được tự động mở lại.`;
    }

    return new ResponseCommon(200, message, result.schedule);
  }

  // ==================== DELETE ====================

  async deleteTimeOff(
    doctorId: string,
    id: string,
  ): Promise<
    ResponseCommon<{
      restoredSlots: number;
    }>
  > {
    const schedule = await this.queryService.validateDoctorOwnership(
      id,
      doctorId,
    );

    if (schedule.scheduleType !== ScheduleType.TIME_OFF) {
      this.logger.error('Invalid schedule type');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (!schedule.specificDate) {
      this.logger.error('Specific date not found');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const specificDate = new Date(schedule.specificDate);
    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const baseDate = startOfDayVN(specificDate);

    const scheduleStart = new Date(
      baseDate.getTime() + (startH * 60 + startM) * 60000,
    );
    const scheduleEnd = new Date(
      baseDate.getTime() + (endH * 60 + endM) * 60000,
    );

    const result = await this.dataSource.transaction(async (manager) => {
      await manager.remove(schedule);

      const restoredSlots = await this.restoreService.restoreSlots(
        manager,
        schedule.doctorId,
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

  private resolveAppointmentEnd(appointment: Appointment): Date | null {
    if (!appointment.scheduledAt) {
      return null;
    }

    if (appointment.timeSlot?.endTime) {
      return new Date(appointment.timeSlot.endTime);
    }

    if (appointment.durationMinutes && appointment.durationMinutes > 0) {
      return new Date(
        appointment.scheduledAt.getTime() + appointment.durationMinutes * 60000,
      );
    }

    if (appointment.timeSlot?.schedule?.slotDuration) {
      return new Date(
        appointment.scheduledAt.getTime() +
          appointment.timeSlot.schedule.slotDuration * 60000,
      );
    }

    return null;
  }
}
