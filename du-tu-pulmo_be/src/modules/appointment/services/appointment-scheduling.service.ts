import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Not } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';

import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { AppointmentMapperService } from '@/modules/appointment/services/appointment-mapper.service';

@Injectable()
export class AppointmentSchedulingService {
  private readonly logger = new Logger(AppointmentSchedulingService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
    private readonly mapper: AppointmentMapperService,
  ) {}

  async cancel(
    id: string,
    reason: string,
    cancelledBy: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!appointment) {
        this.logger.error('Appointment not found');
        throw new NotFoundException(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
      }

      if (appointment.status === AppointmentStatusEnum.COMPLETED) {
        this.logger.error('Appointment is completed');
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_CANCEL_COMPLETED);
      }

      if (appointment.status === AppointmentStatusEnum.CANCELLED) {
        this.logger.error('Appointment is already cancelled');
        throw new BadRequestException(ERROR_MESSAGES.ALREADY_CANCELLED);
      }

      if (appointment.timeSlotId) {
        await manager.decrement(
          TimeSlot,
          { id: appointment.timeSlotId },
          'bookedCount',
          1,
        );

        const slot = await manager.findOne(TimeSlot, {
          where: { id: appointment.timeSlotId },
        });

        if (slot && slot.bookedCount < slot.capacity) {
          await manager.update(
            TimeSlot,
            { id: slot.id },
            { isAvailable: true },
          );
        }
      }

      appointment.status = AppointmentStatusEnum.CANCELLED;
      appointment.cancelledAt = new Date();
      appointment.cancellationReason = reason;
      appointment.cancelledBy = cancelledBy;

      const saved = await manager.save(appointment);

      if (
        appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
        appointment.dailyCoChannel
      ) {
        try {
          await this.dailyService.deleteRoom(appointment.dailyCoChannel);
          void this.callStateService.clearCallsForAppointment(appointment.id);
          this.logger.log(
            `Cleaned up video room for cancelled appointment ${appointment.id}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to cleanup video room: ${error}`);
        }
      }

      return saved;
    });

    return new ResponseCommon(
      200,
      'Hủy lịch hẹn thành công',
      this.mapper.toDto(result),
    );
  }

  async reschedule(
    appointmentId: string,
    newTimeSlotId: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!appointment) {
        this.logger.error('Appointment not found');
        throw new NotFoundException(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
      }

      if (
        ![
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ].includes(appointment.status)
      ) {
        this.logger.error('Appointment is not in confirmed, pending, or pending payment status');
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_RESCHEDULE_STATUS);
      }

      const oldSlot = appointment.timeSlotId
        ? await manager.findOne(TimeSlot, {
            where: { id: appointment.timeSlotId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;

      const newSlot = await manager.findOne(TimeSlot, {
        where: { id: newTimeSlotId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!newSlot) {
        this.logger.error('New slot not found');
        throw new NotFoundException(ERROR_MESSAGES.NEW_SLOT_NOT_FOUND);
      }

      if (newSlot.doctorId !== appointment.doctorId) {
        this.logger.error('Slot doctor mismatch');
        throw new BadRequestException(ERROR_MESSAGES.SLOT_DOCTOR_MISMATCH);
      }

      if (newSlot.startTime < new Date()) {
        this.logger.error('Slot in past');
        throw new BadRequestException(ERROR_MESSAGES.SLOT_IN_PAST);
      }

      if (!newSlot.allowedAppointmentTypes?.length) {
        this.logger.error('Slot has no allowed appointment types');
        throw new BadRequestException(ERROR_MESSAGES.SLOT_NO_TYPE_CONFIG);
      }

      if (
        !newSlot.allowedAppointmentTypes.includes(appointment.appointmentType)
      ) {
        this.logger.error('Slot type mismatch');
        throw new BadRequestException(ERROR_MESSAGES.SLOT_TYPE_MISMATCH);
      }

      const duplicateInNewSlot = await manager.findOne(Appointment, {
        where: {
          patientId: appointment.patientId,
          timeSlotId: newTimeSlotId,
          status: Not(In([AppointmentStatusEnum.CANCELLED])),
        },
        lock: { mode: 'pessimistic_read' },
      });

      if (duplicateInNewSlot) {
        this.logger.error('Duplicate in new slot');
        throw new ConflictException(ERROR_MESSAGES.DUPLICATE_IN_SLOT);
      }

      if (!newSlot.isAvailable) {
        this.logger.error('Slot unavailable');
        throw new ConflictException(ERROR_MESSAGES.SLOT_UNAVAILABLE);
      }

      if (newSlot.bookedCount >= newSlot.capacity) {
        this.logger.error('Slot full');
        throw new ConflictException(ERROR_MESSAGES.SLOT_FULL);
      }

      if (oldSlot) {
        await manager.decrement(TimeSlot, { id: oldSlot.id }, 'bookedCount', 1);
        if (oldSlot.bookedCount - 1 < oldSlot.capacity) {
          await manager.update(
            TimeSlot,
            { id: oldSlot.id },
            { isAvailable: true },
          );
        }
      }

      await manager.increment(TimeSlot, { id: newSlot.id }, 'bookedCount', 1);
      if (newSlot.bookedCount + 1 >= newSlot.capacity) {
        await manager.update(
          TimeSlot,
          { id: newSlot.id },
          { isAvailable: false },
        );
      }

      appointment.timeSlotId = newTimeSlotId;
      appointment.scheduledAt = newSlot.startTime;
      appointment.durationMinutes = Math.floor(
        (newSlot.endTime.getTime() - newSlot.startTime.getTime()) / 60000,
      );

      return manager.save(appointment);
    });

    return new ResponseCommon(
      200,
      'Đổi lịch hẹn thành công',
      this.mapper.toDto(result),
    );
  }
}
