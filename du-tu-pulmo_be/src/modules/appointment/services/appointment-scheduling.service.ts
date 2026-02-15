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
import { APPOINTMENT_ERRORS } from '@/common/constants/error-messages.constant';
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
        throw new NotFoundException(APPOINTMENT_ERRORS.APPOINTMENT_NOT_FOUND);
      }

      if (appointment.status === AppointmentStatusEnum.COMPLETED) {
        throw new BadRequestException(APPOINTMENT_ERRORS.CANNOT_CANCEL_COMPLETED);
      }

      if (appointment.status === AppointmentStatusEnum.CANCELLED) {
        throw new BadRequestException(APPOINTMENT_ERRORS.ALREADY_CANCELLED);
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
          this.callStateService.clearCallsForAppointment(appointment.id);
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
        throw new NotFoundException(APPOINTMENT_ERRORS.APPOINTMENT_NOT_FOUND);
      }

      if (
        ![
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ].includes(appointment.status)
      ) {
        throw new BadRequestException(APPOINTMENT_ERRORS.CANNOT_RESCHEDULE_STATUS);
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
        throw new NotFoundException(APPOINTMENT_ERRORS.NEW_SLOT_NOT_FOUND);
      }

      if (newSlot.doctorId !== appointment.doctorId) {
        throw new BadRequestException(APPOINTMENT_ERRORS.SLOT_DOCTOR_MISMATCH);
      }

      if (newSlot.startTime < new Date()) {
        throw new BadRequestException(APPOINTMENT_ERRORS.SLOT_IN_PAST);
      }

      if (!newSlot.allowedAppointmentTypes?.length) {
        throw new BadRequestException(
          APPOINTMENT_ERRORS.SLOT_NO_TYPE_CONFIG,
        );
      }

      if (
        !newSlot.allowedAppointmentTypes.includes(appointment.appointmentType)
      ) {
        throw new BadRequestException(
          APPOINTMENT_ERRORS.SLOT_TYPE_MISMATCH(
            appointment.appointmentType,
            newSlot.allowedAppointmentTypes.join(', '),
          ),
        );
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
        throw new ConflictException(APPOINTMENT_ERRORS.DUPLICATE_IN_SLOT);
      }

      if (!newSlot.isAvailable) {
        throw new ConflictException(APPOINTMENT_ERRORS.SLOT_UNAVAILABLE);
      }

      if (newSlot.bookedCount >= newSlot.capacity) {
        throw new ConflictException(APPOINTMENT_ERRORS.SLOT_FULL);
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
