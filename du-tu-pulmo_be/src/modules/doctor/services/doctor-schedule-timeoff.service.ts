import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, In, Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import {
  CreateTimeOffDto,
  UpdateTimeOffDto,
} from '@/modules/doctor/dto/time-off.dto';
import { UpdateDoctorScheduleDto } from '@/modules/doctor/dto/doctor-schedule.dto';
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

@Injectable()
export class DoctorScheduleTimeOffService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
    private readonly helper: DoctorScheduleHelperService,
    private readonly queryService: DoctorScheduleQueryService,
    private readonly updateService: DoctorScheduleUpdateService,
    private readonly restoreService: DoctorScheduleRestoreService,
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
    const dayOfWeek = specificDate.getDay();
    const priority = SCHEDULE_TYPE_PRIORITY[ScheduleType.TIME_OFF];

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const specificDateNormalized = new Date(specificDate);
    specificDateNormalized.setHours(0, 0, 0, 0);
    if (specificDateNormalized.getTime() < today.getTime()) {
      throw new BadRequestException(
        'Không thể tạo lịch nghỉ cho ngày trong quá khứ',
      );
    }

    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id'],
    });
    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ với ID ${doctorId}`);
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

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    const result = await this.dataSource.transaction(async (manager) => {
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

      for (const apt of conflicting) {
        apt.status = AppointmentStatusEnum.CANCELLED;
        apt.cancelledAt = new Date();
        apt.cancellationReason = 'TIME_OFF';
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
      };
    });

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
    } as any);
  }

  // ==================== UPDATE ====================

  async updateTimeOff(
    id: string,
    dto: UpdateTimeOffDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.queryService.findById(id);
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

      const cancelAppointmentsInRange = async (
        rangeStart: Date,
        rangeEnd: Date,
      ): Promise<Appointment[]> => {
        const conflicting = appointments.filter((apt) => {
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
              .softDelete()
              .from(TimeSlot)
              .where('id = :id', { id: apt.timeSlotId })
              .execute();
          }
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
      let totalPreviouslyCancelled = 0; // ✅ Track this

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
        const restored =
          await this.restoreService.restoreSlotsFromRegularSchedules(
            manager,
            existing.doctorId,
            dayOfWeek,
            specificDate,
            range.start,
            range.end,
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
      } as {
        schedule: DoctorSchedule;
        cancelledAppointments: Appointment[];
        disabledSlots: number;
        restoredSlots: number;
        previouslyCancelledCount: number;
      };
    });

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
    if (result.previouslyCancelledCount > 0) {
      message += ` ⚠️ LIÊN QUAN ĐẾN KHÔI PHỤC: ${result.previouslyCancelledCount} lịch hẹn đã bị hủy trước đó trong khoảng thời gian khôi phục sẽ KHÔNG được tự động mở lại.`;
    }

    return new ResponseCommon(200, message, result.schedule);
  }

  // ==================== DELETE ====================

  async deleteTimeOff(id: string): Promise<
    ResponseCommon<{
      restoredSlots: number;
    }>
  > {
    const existingResult = await this.queryService.findById(id);
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

    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    const result = await this.dataSource.transaction(async (manager) => {
      await manager.remove(schedule);

      const restoredSlots =
        await this.restoreService.restoreSlotsFromRegularSchedules(
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
}
