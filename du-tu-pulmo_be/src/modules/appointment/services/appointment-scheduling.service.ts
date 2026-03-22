import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { CANCELLATION_POLICY } from '@/modules/appointment/appointment.constants';
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
import {
  Payment,
  PaymentStatus,
} from '@/modules/payment/entities/payment.entity';
import { PayosService } from '@/modules/payment/payos.service';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';

import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { AppointmentMapperService } from '@/modules/appointment/services/appointment-mapper.service';
import { ConsultationPricingService } from '@/modules/doctor/services/consultation-pricing.service';
import { NotificationService } from '@/modules/notification/notification.service';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';

@Injectable()
export class AppointmentSchedulingService {
  private readonly logger = new Logger(AppointmentSchedulingService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
    private readonly mapper: AppointmentMapperService,
    private readonly payosService: PayosService,
    private readonly pricingService: ConsultationPricingService,
    private readonly notificationService: NotificationService,
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

      // ── Kiểm tra quá hạn ──────────────────────────────────────────
      if (new Date(appointment.scheduledAt) < new Date()) {
        this.logger.error('Cannot cancel expired appointment');
        throw new BadRequestException(
          ERROR_MESSAGES.CANNOT_EDIT_EXPIRED_APPOINTMENT,
        );
      }

      if (appointment.status === AppointmentStatusEnum.COMPLETED) {
        this.logger.error('Appointment is completed');
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_CANCEL_COMPLETED);
      }

      if (appointment.status === AppointmentStatusEnum.CANCELLED) {
        this.logger.error('Appointment is already cancelled');
        throw new BadRequestException(ERROR_MESSAGES.ALREADY_CANCELLED);
      }

      // ── Kiểm tra trạng thái được phép hủy theo role ─────────────────
      const PATIENT_CANCELLABLE = [
        AppointmentStatusEnum.PENDING_PAYMENT,
        AppointmentStatusEnum.PENDING,
        AppointmentStatusEnum.CONFIRMED,
      ];
      const STAFF_CANCELLABLE = [
        AppointmentStatusEnum.PENDING_PAYMENT,
        AppointmentStatusEnum.PENDING,
        AppointmentStatusEnum.CONFIRMED,
      ];

      const allowedStatuses =
        cancelledBy === 'PATIENT' ? PATIENT_CANCELLABLE : STAFF_CANCELLABLE;

      if (!allowedStatuses.includes(appointment.status)) {
        if (appointment.status === AppointmentStatusEnum.IN_PROGRESS) {
          throw new BadRequestException(
            ERROR_MESSAGES.CANNOT_CANCEL_IN_PROGRESS,
          );
        }
        if (appointment.status === AppointmentStatusEnum.CHECKED_IN) {
          throw new BadRequestException(
            ERROR_MESSAGES.CANNOT_CANCEL_CHECKED_IN,
          );
        }
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_CANCEL_COMPLETED);
      }

      // ── Kiểm tra thời gian (chỉ khi CONFIRMED — lúc này chỉ STAFF mới tới được đây) ───────────────────
      if (appointment.status === AppointmentStatusEnum.CONFIRMED) {
        const now = new Date();
        const minutesUntilStart =
          (new Date(appointment.scheduledAt).getTime() - now.getTime()) /
          (1000 * 60);

        if (cancelledBy === 'PATIENT') {
          if (
            minutesUntilStart <
            CANCELLATION_POLICY.PATIENT_CANCEL_BEFORE_MINUTES
          ) {
            throw new BadRequestException(
              ERROR_MESSAGES.CANCEL_TOO_LATE_PATIENT,
            );
          }
        }

        if (cancelledBy === 'DOCTOR') {
          if (
            minutesUntilStart < CANCELLATION_POLICY.DOCTOR_CANCEL_BEFORE_MINUTES
          ) {
            throw new BadRequestException(
              ERROR_MESSAGES.CANCEL_TOO_LATE_DOCTOR,
            );
          }
        }
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

      appointment.cancelledAt = new Date();
      appointment.cancellationReason = reason;
      appointment.cancelledBy = cancelledBy;

      const scheduledTimeForAudit = new Date(appointment.scheduledAt);
      const minutesUntilStartForAudit =
        (scheduledTimeForAudit.getTime() - appointment.cancelledAt.getTime()) /
        (1000 * 60);
      appointment.cancelledMinutesBeforeStart = Math.floor(
        minutesUntilStartForAudit,
      );
      appointment.status = AppointmentStatusEnum.CANCELLED;

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

    const apptWithRelations = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { id },
        relations: ['patient', 'patient.user', 'doctor', 'doctor.user'],
      });

    if (apptWithRelations) {
      const cancellerName =
        cancelledBy === 'DOCTOR'
          ? 'Bác sĩ'
          : cancelledBy === 'PATIENT'
            ? 'Bệnh nhân'
            : 'Hệ thống';

      // Notify patient
      if (apptWithRelations.patient?.user?.id) {
        void this.notificationService.createNotification({
          userId: apptWithRelations.patient.user.id,
          type: NotificationTypeEnum.APPOINTMENT,
          title: 'Lịch hẹn đã bị hủy',
          content: `Lịch hẹn ${result.appointmentNumber} đã bị hủy bởi ${cancellerName}. Lý do: ${reason}.`,
          refId: id,
          refType: 'APPOINTMENT',
        });
      }

      // Notify doctor
      if (apptWithRelations.doctor?.user?.id) {
        void this.notificationService.createNotification({
          userId: apptWithRelations.doctor.user.id,
          type: NotificationTypeEnum.APPOINTMENT,
          title: 'Lịch hẹn đã bị hủy',
          content: `Lịch hẹn ${result.appointmentNumber} đã bị hủy bởi ${cancellerName}.`,
          refId: id,
          refType: 'APPOINTMENT',
        });
      }
    }

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

      // ── Kiểm tra quá hạn ──────────────────────────────────────────
      if (new Date(appointment.scheduledAt) < new Date()) {
        this.logger.error('Cannot reschedule expired appointment');
        throw new BadRequestException(
          ERROR_MESSAGES.CANNOT_EDIT_EXPIRED_APPOINTMENT,
        );
      }

      if (
        ![
          AppointmentStatusEnum.PENDING,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ].includes(appointment.status)
      ) {
        this.logger.error(
          'Appointment is not in confirmed, pending, or pending payment status',
        );
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_RESCHEDULE_STATUS);
      }

      const hasPaidPayment = await manager.exists(Payment, {
        where: [
          { appointmentId: appointment.id, status: PaymentStatus.PAID },
          ...(appointment.paymentId
            ? [{ id: appointment.paymentId, status: PaymentStatus.PAID }]
            : []),
        ],
      });
      const paidAmount = Number(appointment.paidAmount || 0);
      const isPaidAppointment = paidAmount > 0 && hasPaidPayment;
      if (isPaidAppointment) {
        this.logger.error('Paid appointment cannot be rescheduled');
        throw new BadRequestException(
          ERROR_MESSAGES.CANNOT_RESCHEDULE_PAID_APPOINTMENT,
        );
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
        const refreshedOldSlot = await manager.findOne(TimeSlot, {
          where: { id: oldSlot.id },
        });
        if (
          refreshedOldSlot &&
          refreshedOldSlot.bookedCount < refreshedOldSlot.capacity
        ) {
          await manager.update(
            TimeSlot,
            { id: refreshedOldSlot.id },
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
      const schedule = newSlot.scheduleId
        ? await manager.findOne(DoctorSchedule, {
            where: { id: newSlot.scheduleId },
            select: ['id', 'consultationFee', 'discountPercent'],
          })
        : null;
      const doctor = await manager.findOne(Doctor, {
        where: { id: newSlot.doctorId },
        select: ['id', 'defaultConsultationFee'],
      });
      const baseFee = this.pricingService.resolveBaseFee(
        schedule?.consultationFee,
        doctor?.defaultConsultationFee,
      );
      const { finalFee } = this.pricingService.calculateFinalFee(
        baseFee,
        schedule?.discountPercent,
      );

      const pendingPayments = await manager.find(Payment, {
        where: {
          appointmentId: appointment.id,
          status: In([PaymentStatus.PENDING, PaymentStatus.PROCESSING]),
        },
      });

      for (const payment of pendingPayments) {
        try {
          await this.payosService.cancelPaymentLink(
            Number(payment.orderCode),
            'INVALIDATED_BY_RESCHEDULE',
          );
        } catch (error) {
          this.logger.warn(
            `Gateway cancel failed for payment ${payment.id}, continue reschedule: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        payment.status = PaymentStatus.CANCELLED;
        payment.cancelledAt = new Date();
        payment.cancellationReason = payment.cancellationReason
          ? `${payment.cancellationReason};INVALIDATED_BY_RESCHEDULE`
          : 'INVALIDATED_BY_RESCHEDULE';
        payment.errorCode = 'INVALIDATED_BY_RESCHEDULE';
        payment.errorMessage =
          'Payment invalidated due to appointment reschedule';
        payment.lastErrorAt = new Date();
        await manager.save(payment);
      }

      appointment.feeAmount = this.pricingService.toVndString(finalFee);
      appointment.paidAmount = '0';
      appointment.paymentId = null;
      appointment.status =
        finalFee === 0
          ? AppointmentStatusEnum.CONFIRMED
          : AppointmentStatusEnum.PENDING_PAYMENT;

      if (appointment.meetingUrl || appointment.dailyCoChannel) {
        const oldChannel = appointment.dailyCoChannel;
        appointment.meetingUrl = null;
        appointment.dailyCoChannel = null;
        appointment.meetingRoomId = null;
        appointment.meetingPassword = null;
        appointment.dailyCoToken = null;

        // Cleanup Daily.co room outside the transaction after saving
        if (oldChannel) {
          setImmediate(async () => {
            try {
              await this.dailyService.deleteRoom(oldChannel);
              this.logger.log(
                `Cleaned up old video room ${oldChannel} after reschedule`,
              );
            } catch (err) {
              this.logger.warn(
                `Failed to cleanup video room on reschedule: ${err}`,
              );
            }
          });
        }
      }

      return manager.save(appointment);
    });

    const apptWithRelations = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { id: appointmentId },
        relations: ['patient', 'patient.user', 'doctor', 'doctor.user'],
      });

    if (apptWithRelations) {
      const newDate = result.scheduledAt.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (apptWithRelations.patient?.user?.id) {
        void this.notificationService.createNotification({
          userId: apptWithRelations.patient.user.id,
          type: NotificationTypeEnum.APPOINTMENT,
          title: 'Đổi lịch thành công',
          content: `Lịch hẹn đã được dời sang ${newDate}.`,
          refId: appointmentId,
          refType: 'APPOINTMENT',
        });
      }

      if (apptWithRelations.doctor?.user?.id) {
        void this.notificationService.createNotification({
          userId: apptWithRelations.doctor.user.id,
          type: NotificationTypeEnum.APPOINTMENT,
          title: 'Lịch hẹn đã được dời',
          content: `Lịch hẹn đã được bệnh nhân dời sang ${newDate}.`,
          refId: appointmentId,
          refType: 'APPOINTMENT',
        });
      }
    }

    return new ResponseCommon(
      200,
      'Đổi lịch hẹn thành công',
      this.mapper.toDto(result),
    );
  }
}
