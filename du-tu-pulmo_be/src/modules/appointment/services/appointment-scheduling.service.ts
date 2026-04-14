import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { CANCELLATION_POLICY } from '@/modules/appointment/appointment.constants';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
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
import { AppointmentCancellationCoreService } from '@/modules/appointment/services/appointment-cancellation-core.service';
import { vnNow } from '@/common/datetime';

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
    private readonly appointmentCancellationCore: AppointmentCancellationCoreService,
  ) {}

  private validateSlotBookingWindow(
    slotStartTime: Date,
    schedule: DoctorSchedule | null,
  ): void {
    const now = vnNow();
    const minimumBookingTime = schedule?.minimumBookingTime ?? 0;
    const earliestAllowed = new Date(
      now.getTime() + minimumBookingTime * 60 * 1000,
    );

    if (slotStartTime < earliestAllowed) {
      this.logger.error('Time slot is before minimum booking window');
      throw new BadRequestException(ERROR_MESSAGES.APPOINTMENT_TIME_INVALID);
    }

    const maxAdvanceBookingDays = schedule?.maxAdvanceBookingDays ?? 30;
    const latestAllowed = new Date(
      now.getTime() + maxAdvanceBookingDays * 24 * 60 * 60 * 1000,
    );

    if (slotStartTime > latestAllowed) {
      this.logger.error('Time slot is after max advance booking window');
      throw new BadRequestException(ERROR_MESSAGES.APPOINTMENT_TIME_INVALID);
    }
  }

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

      // 1. Terminal states trước tiên
      if (appointment.status === AppointmentStatusEnum.COMPLETED) {
        this.logger.error('Appointment is completed');
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_CANCEL_COMPLETED);
      }

      if (appointment.status === AppointmentStatusEnum.CANCELLED) {
        this.logger.error('Appointment is already cancelled');
        throw new BadRequestException(ERROR_MESSAGES.ALREADY_CANCELLED);
      }

      if (appointment.status === AppointmentStatusEnum.NO_SHOW) {
        this.logger.error('Appointment is NO_SHOW');
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_CANCEL_COMPLETED);
      }

      const NON_EXPIRY_STATUSES = [
        AppointmentStatusEnum.PENDING_PAYMENT,
        AppointmentStatusEnum.PENDING,
        AppointmentStatusEnum.CHECKED_IN,
      ];

      if (
        !NON_EXPIRY_STATUSES.includes(appointment.status) &&
        new Date(appointment.scheduledAt) < new Date()
      ) {
        this.logger.error('Cannot cancel expired appointment');
        throw new BadRequestException(
          ERROR_MESSAGES.CANNOT_EDIT_EXPIRED_APPOINTMENT,
        );
      }

      const PATIENT_CANCELLABLE = [
        AppointmentStatusEnum.PENDING_PAYMENT,
        AppointmentStatusEnum.PENDING,
        AppointmentStatusEnum.CONFIRMED,
      ];

      const STAFF_CANCELLABLE = [
        AppointmentStatusEnum.PENDING_PAYMENT,
        AppointmentStatusEnum.PENDING,
        AppointmentStatusEnum.CONFIRMED,
        AppointmentStatusEnum.CHECKED_IN,
      ];

      const allowedStatuses =
        cancelledBy === 'PATIENT' ? PATIENT_CANCELLABLE : STAFF_CANCELLABLE;

      if (!allowedStatuses.includes(appointment.status)) {
        switch (appointment.status) {
          case AppointmentStatusEnum.IN_PROGRESS:
            throw new BadRequestException(
              ERROR_MESSAGES.CANNOT_CANCEL_IN_PROGRESS,
            );
          case AppointmentStatusEnum.CHECKED_IN:
            // Chỉ PATIENT mới rơi vào đây (STAFF đã có CHECKED_IN trong list)
            throw new BadRequestException(
              ERROR_MESSAGES.CANNOT_CANCEL_CHECKED_IN,
            );
          default:
            throw new BadRequestException(
              ERROR_MESSAGES.CANNOT_CANCEL_COMPLETED,
            );
        }
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

      const cancellationEffect =
        await this.appointmentCancellationCore.cancelAppointmentInTransaction(
          manager,
          {
            appointment,
            reason,
            cancelledBy,
            paymentCancellationReason: 'APPOINTMENT_CANCELLED',
            slotAction: 'release',
          },
        );

      return {
        saved: appointment,
        cancellationEffects: [cancellationEffect],
      };
    });

    this.appointmentCancellationCore.schedulePostCommitEffects(
      result.cancellationEffects,
    );

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
          content: `Lịch hẹn ${result.saved.appointmentNumber} đã bị hủy bởi ${cancellerName}. Lý do: ${reason}.`,
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
          content: `Lịch hẹn ${result.saved.appointmentNumber} đã bị hủy bởi ${cancellerName}.`,
          refId: id,
          refType: 'APPOINTMENT',
        });
      }
    }

    return new ResponseCommon(
      200,
      'Hủy lịch hẹn thành công',
      this.mapper.toDto(apptWithRelations ?? result.saved),
    );
  }

  async reschedule(
    appointmentId: string,
    newTimeSlotId: string,
    rescheduledBy: string,
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

      const RESCHEDULE_ALLOWED_STATUSES = [
        AppointmentStatusEnum.PENDING,
        AppointmentStatusEnum.PENDING_PAYMENT,
        AppointmentStatusEnum.CONFIRMED, // ← FIX: thêm CONFIRMED
      ];

      if (!RESCHEDULE_ALLOWED_STATUSES.includes(appointment.status)) {
        this.logger.error('Appointment status does not allow reschedule');
        throw new BadRequestException(ERROR_MESSAGES.CANNOT_RESCHEDULE_STATUS);
      }

      // Áp dụng time restriction giống cancel, chỉ khi status = CONFIRMED
      if (appointment.status === AppointmentStatusEnum.CONFIRMED) {
        const now = new Date();
        const minutesUntilStart =
          (new Date(appointment.scheduledAt).getTime() - now.getTime()) /
          (1000 * 60);

        if (rescheduledBy === 'PATIENT') {
          if (
            minutesUntilStart <
            CANCELLATION_POLICY.PATIENT_CANCEL_BEFORE_MINUTES // 4 * 60 = 240 phút
          ) {
            throw new BadRequestException(
              ERROR_MESSAGES.RESCHEDULE_TOO_LATE_PATIENT,
            );
          }
        }

        if (rescheduledBy === 'DOCTOR') {
          if (
            minutesUntilStart < CANCELLATION_POLICY.DOCTOR_CANCEL_BEFORE_MINUTES // 2 * 60 = 120 phút
          ) {
            throw new BadRequestException(
              ERROR_MESSAGES.RESCHEDULE_TOO_LATE_DOCTOR,
            );
          }
        }
        // ADMIN / RECEPTIONIST: không có giới hạn thời gian
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

      if (appointment.timeSlotId === newTimeSlotId) {
        this.logger.error('New slot must be different from current slot');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      if (newSlot.startTime < new Date()) {
        this.logger.error('Slot in past');
        throw new BadRequestException(ERROR_MESSAGES.SLOT_IN_PAST);
      }

      const schedule = newSlot.scheduleId
        ? await manager.findOne(DoctorSchedule, {
            where: { id: newSlot.scheduleId },
            select: [
              'id',
              'consultationFee',
              'discountPercent',
              'minimumBookingTime',
              'maxAdvanceBookingDays',
            ],
          })
        : null;

      this.validateSlotBookingWindow(newSlot.startTime, schedule);

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

      const overlappingAppointment = await manager
        .createQueryBuilder(Appointment, 'apt')
        .setLock('pessimistic_read')
        .innerJoin('apt.timeSlot', 'existingSlot')
        .where('apt.patientId = :patientId', {
          patientId: appointment.patientId,
        })
        .andWhere('apt.id != :appointmentId', {
          appointmentId: appointment.id,
        })
        .andWhere('apt.status NOT IN (:...statuses)', {
          statuses: [AppointmentStatusEnum.CANCELLED],
        })
        .andWhere(
          '(existingSlot.startTime < :newEndTime AND existingSlot.endTime > :newStartTime)',
          {
            newEndTime: newSlot.endTime,
            newStartTime: newSlot.startTime,
          },
        )
        .getOne();

      if (overlappingAppointment) {
        this.logger.error('Patient has overlapping appointment in new slot');
        throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
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

      // GIAI ĐOẠN 1 (trong transaction): Mark CANCELLED local + đánh dấu chờ sync gateway
      for (const payment of pendingPayments) {
        payment.status = PaymentStatus.CANCELLED;
        payment.cancelledAt = new Date();
        payment.cancellationReason = payment.cancellationReason
          ? `${payment.cancellationReason};INVALIDATED_BY_RESCHEDULE`
          : 'INVALIDATED_BY_RESCHEDULE';
        payment.errorCode = 'PENDING_GATEWAY_CANCEL'; // ← đánh dấu cần sync lại
        payment.errorMessage =
          'Payment invalidated due to appointment reschedule, pending gateway cancel';
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

      const oldChannel = appointment.dailyCoChannel;
      if (appointment.meetingUrl || appointment.dailyCoChannel) {
        appointment.meetingUrl = null;
        appointment.dailyCoChannel = null;
        appointment.meetingRoomId = null;
        appointment.meetingPassword = null;
        appointment.dailyCoToken = null;
      }

      const saved = await manager.save(appointment);

      return {
        saved,
        paymentsToCancel: [...pendingPayments],
        roomToDelete: oldChannel,
      };
    });

    if (result.roomToDelete) {
      setImmediate(() => {
        void (async () => {
          try {
            await this.dailyService.deleteRoom(result.roomToDelete!);
            await this.callStateService.clearCallsForAppointment(appointmentId);
            this.logger.log(
              `Cleaned up old video room ${result.roomToDelete} after reschedule`,
            );
          } catch (err) {
            this.logger.warn(
              `Failed to cleanup video room on reschedule: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        })();
      });
    }

    setImmediate(() => {
      void (async () => {
        for (const payment of result.paymentsToCancel) {
          try {
            await this.payosService.cancelPaymentLink(
              Number(payment.orderCode),
              'INVALIDATED_BY_RESCHEDULE',
            );

            // Xóa error code khi gateway thành công
            await this.dataSource.getRepository(Payment).update(payment.id, {
              errorCode: null,
              errorMessage: null,
            });

            this.logger.log(
              `Gateway cancelled payment ${payment.id} for reschedule`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to cancel payment ${payment.id} on gateway. ` +
                `Will be retried by cron. Error: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      })();
    });

    const apptWithRelations = await this.dataSource
      .getRepository(Appointment)
      .findOne({
        where: { id: appointmentId },
        relations: ['patient', 'patient.user', 'doctor', 'doctor.user'],
      });

    if (apptWithRelations) {
      const newDate = result.saved.scheduledAt.toLocaleDateString('vi-VN', {
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
      this.mapper.toDto(apptWithRelations ?? result.saved),
    );
  }
}
