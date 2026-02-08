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
import {
  endOfDayVN,
  startOfDayVN,
  vnNow,
} from '@/common/datetime';

@Injectable()
export class DoctorScheduleFlexibleService {
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

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const today = startOfDayVN(vnNow());
    if (specificDate < today) {
      throw new BadRequestException(
        'Không thể tạo lịch cho ngày trong quá khứ',
      );
    }

    const doctor = await this.doctorRepository.findOne({
      where: { id: doctorId },
      select: ['id', 'primaryHospitalId'],
    });
    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ với ID ${doctorId}`);
    }

    if (dto.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (!doctor.primaryHospitalId) {
        throw new BadRequestException(
          'Khám tại phòng khám yêu cầu bác sĩ có bệnh viện/phòng khám chính (primaryHospitalId)',
        );
      }
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
    
    // specificDate usually is 00:00 VN if it came from normalized source or simple YYYY-MM-DD
    // But safely: derive base from it.
    // If specificDate is already a valid Date object?
    // Let's assume specificDate IS the base.
    
    const baseDate = startOfDayVN(specificDate);

    const scheduleStart = new Date(baseDate.getTime() + (startH * 60 + startM) * 60000);
    const scheduleEnd = new Date(baseDate.getTime() + (endH * 60 + endM) * 60000);

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
        if (!apt.timeSlot?.schedule?.slotDuration) return false;
        const aptEnd = new Date(
          apt.scheduledAt.getTime() +
            apt.timeSlot.schedule.slotDuration * 60 * 1000,
        );
        const isCompletelyInside =
          apt.scheduledAt >= scheduleStart && aptEnd <= scheduleEnd;

        return !isCompletelyInside;
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

      await manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('doctorId = :doctorId', { doctorId })
        .andWhere('startTime < :endOfDay AND endTime > :startOfDay', {
          endOfDay,
          startOfDay,
        })
        .andWhere('bookedCount = 0')
        .execute();

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

      const existingSlots = await manager.find(TimeSlot, {
        where: {
          doctorId,
          startTime: Between(scheduleStart, scheduleEnd),
        },
      });

      const slotDurationMs = dto.slotDuration * 60 * 1000;
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
      };
    });

    this.sendFlexibleScheduleNotifications(result.cancelledAppointments);

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
    id: string,
    dto: UpdateFlexibleScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.queryService.findById(id);
    const existing = existingResult.data!;

    if (existing.scheduleType !== ScheduleType.FLEXIBLE) {
      throw new BadRequestException('Lịch này không phải là lịch linh hoạt');
    }

    const timeChanged =
      (dto.startTime && dto.startTime !== existing.startTime) ||
      (dto.endTime && dto.endTime !== existing.endTime);

    if (timeChanged) {
      return this.updateFlexibleScheduleWithSlotSync(id, dto, existing);
    }

    const updateDto: UpdateDoctorScheduleDto = {
      id,
      slotCapacity: dto.slotCapacity,
      slotDuration: dto.slotDuration,
      appointmentType: dto.appointmentType,
      consultationFee: dto.consultationFee,
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
      throw new BadRequestException('Lịch linh hoạt phải có specificDate');
    }

    const specificDate = new Date(existing.specificDate);
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;

    if (newStartTime >= newEndTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const [startH, startM] = newStartTime.split(':').map(Number);
    const [endH, endM] = newEndTime.split(':').map(Number);
    
    const baseDate = startOfDayVN(specificDate);

    const scheduleStart = new Date(baseDate.getTime() + (startH * 60 + startM) * 60000);
    const scheduleEnd = new Date(baseDate.getTime() + (endH * 60 + endM) * 60000);

    const result = await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .delete()
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

      // count appointments outside new range and MARK as conflict
      const appointmentsOutsideNewRange = appointments.filter((apt) => {
        if (!apt.timeSlot?.schedule?.slotDuration) return false;
        const aptEnd = new Date(
          apt.scheduledAt.getTime() +
            apt.timeSlot.schedule.slotDuration * 60 * 1000,
        );

        const isCompletelyInside =
          apt.scheduledAt >= scheduleStart && aptEnd <= scheduleEnd;

        return !isCompletelyInside;
      });

      // DO NOT cancel appointments automatically. Mark them as conflicted.
      for (const apt of appointmentsOutsideNewRange) {
        apt.conflict = true;
        apt.conflictReason = 'OUTSIDE_FLEXIBLE_SCHEDULE';
        await manager.save(apt);
      }

      await manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('doctorId = :doctorId', { doctorId: existing.doctorId })
        .andWhere('startTime < :endOfDay AND endTime > :startOfDay', {
          endOfDay,
          startOfDay,
        })
        .andWhere('bookedCount = 0')
        .execute();

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

      const updatedSchedule = await manager.findOne(DoctorSchedule, {
        where: { id },
      });

      const existingSlots = await manager.find(TimeSlot, {
        where: {
          doctorId: existing.doctorId,
          startTime: Between(scheduleStart, scheduleEnd),
        },
      });

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
        appointmentsOutsideCount: appointmentsOutsideNewRange.length,
        generatedSlots: slotEntities.length,
      };
    });

    let message = `Cập nhật lịch thành công.`;
    if (result.appointmentsOutsideCount > 0) {
      message += ` ⚠️ CÓ ${result.appointmentsOutsideCount} lịch hẹn nằm NGOÀI khung giờ mới. Vui lòng kiểm tra và xử lý.`;
    }
    message += ` Đã tạo ${result.generatedSlots} time slots mới.`;

    return new ResponseCommon(200, message, result.schedule);
  }

  // ==================== DELETE ====================

  async deleteFlexibleSchedule(id: string): Promise<
    ResponseCommon<{
      appointmentsCount: number;
      appointmentsOutsideRegular: number;
      deletedSlots: number;
      restoredSlots: number;
    }>
  > {
    const existingResult = await this.queryService.findById(id);
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

    const [startH, startM] = schedule.startTime.split(':').map(Number);
    const [endH, endM] = schedule.endTime.split(':').map(Number);
    
    const baseDate = startOfDayVN(specificDate);

    const scheduleStart = new Date(baseDate.getTime() + (startH * 60 + startM) * 60000);
    const scheduleEnd = new Date(baseDate.getTime() + (endH * 60 + endM) * 60000);

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

      // 1. Find REGULAR schedules for this day for coverage check
      const regularSchedules = await manager.find(DoctorSchedule, {
        where: {
          doctorId: schedule.doctorId,
          dayOfWeek,
          scheduleType: ScheduleType.REGULAR,
          isAvailable: true,
        },
      });

      // 2. Count appointments that will be outside REGULAR range
      let appointmentsOutsideRegular = 0;
      for (const apt of dayAppointments) {
        if (!apt.timeSlot?.schedule?.slotDuration) continue;
        const aptEnd = new Date(
          apt.scheduledAt.getTime() +
            apt.timeSlot.schedule.slotDuration * 60 * 1000,
        );

        let isCoveredByRegular = false;
        for (const reg of regularSchedules) {
          const [regStartH, regStartM] = reg.startTime.split(':').map(Number);
          const [regEndH, regEndM] = reg.endTime.split(':').map(Number);

          // Construct regStart and regEnd based on specificDate (which acts as base here for day)
          // We assume specificDate is the target day.
          const base = startOfDayVN(specificDate);
          
          const regStart = new Date(base.getTime() + (regStartH * 60 + regStartM) * 60000);
          const regEnd = new Date(base.getTime() + (regEndH * 60 + regEndM) * 60000);

          if (apt.scheduledAt >= regStart && aptEnd <= regEnd) {
            isCoveredByRegular = true;
            break;
          }
        }

        if (!isCoveredByRegular) {
          appointmentsOutsideRegular++;
          apt.conflict = true;
          apt.conflictReason = 'OUTSIDE_REGULAR_SCHEDULE';
          await manager.save(apt);
        }
      }

      const deleteResult = await manager
        .createQueryBuilder()
        .delete()
        .from(TimeSlot)
        .where('scheduleId = :scheduleId', { scheduleId: id })
        .andWhere('bookedCount = 0')
        .execute();

      await manager.remove(schedule);

      const restoredSlots =
        await this.restoreService.restoreSlots(
          manager,
          schedule.doctorId,
          specificDate,
          scheduleStart,
          scheduleEnd,
        );

      return {
        appointmentsCount: dayAppointments.length,
        appointmentsOutsideRegular,
        deletedSlots: deleteResult.affected || 0,
        restoredSlots,
      };
    });

    // Notifications removed since we don't auto-cancel anymore

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

  private sendFlexibleScheduleNotifications(
    cancelledAppointments: Appointment[],
  ): void {
    if (cancelledAppointments.length > 0) {
      this.notificationService
        .notifyCancelledAppointments(cancelledAppointments, 'SCHEDULE_CHANGE')
        .catch((err) => {
          console.error('Failed to send notifications:', err);
        });
    }
  }
}
