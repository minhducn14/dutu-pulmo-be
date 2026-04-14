import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { vnNow } from '@/common/datetime';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import {
  Payment,
  PaymentStatus,
} from '@/modules/payment/entities/payment.entity';
import { PayosService } from '@/modules/payment/payos.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { DailyService } from '@/modules/video_call/daily.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';

export type AppointmentCancellationSlotAction =
  | 'release'
  | 'soft_delete'
  | 'none';

export interface AppointmentCancellationCoreOptions {
  appointment: Appointment;
  reason: string;
  cancelledBy: string;
  paymentCancellationReason: string;
  slotAction?: AppointmentCancellationSlotAction;
  additionalUpdates?: Partial<Appointment>;
}

interface PaymentGatewayCancellationTarget {
  paymentId: string;
  orderCode: string;
}

export interface AppointmentCancellationPostCommitEffect {
  appointmentId: string;
  cleanupVideo: boolean;
  roomToDelete: string | null;
  paymentGatewayReason: string;
  paymentsToCancel: PaymentGatewayCancellationTarget[];
}

@Injectable()
export class AppointmentCancellationCoreService {
  private readonly logger = new Logger(AppointmentCancellationCoreService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
    private readonly payosService: PayosService,
  ) {}

  async cancelAppointmentInTransaction(
    manager: EntityManager,
    options: AppointmentCancellationCoreOptions,
  ): Promise<AppointmentCancellationPostCommitEffect> {
    const slotAction = options.slotAction ?? 'none';
    const appointment = await manager.findOne(Appointment, {
      where: { id: options.appointment.id },
      lock: { mode: 'pessimistic_write' },
    });

    if (!appointment) {
      throw new NotFoundException(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
    }

    const cancelledAt = vnNow();

    if (slotAction === 'release' && appointment.timeSlotId) {
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
        await manager.update(TimeSlot, { id: slot.id }, { isAvailable: true });
      }
    }

    if (slotAction === 'soft_delete' && appointment.timeSlotId) {
      await manager
        .createQueryBuilder()
        .softDelete()
        .from(TimeSlot)
        .where('id = :id', { id: appointment.timeSlotId })
        .execute();
    }

    const pendingPayments = await manager.find(Payment, {
      where: {
        appointmentId: appointment.id,
        status: In([PaymentStatus.PENDING, PaymentStatus.PROCESSING]),
      },
    });

    appointment.cancelledAt = cancelledAt;
    appointment.cancellationReason = options.reason;
    appointment.cancelledBy = options.cancelledBy;
    appointment.cancelledMinutesBeforeStart = Math.floor(
      (new Date(appointment.scheduledAt).getTime() - cancelledAt.getTime()) /
        (1000 * 60),
    );
    appointment.paymentId = null;
    appointment.status = AppointmentStatusEnum.CANCELLED;

    if (options.additionalUpdates) {
      Object.assign(appointment, options.additionalUpdates);
    }

    for (const payment of pendingPayments) {
      payment.status = PaymentStatus.CANCELLED;
      payment.cancelledAt = cancelledAt;
      payment.cancellationReason = payment.cancellationReason
        ? `${payment.cancellationReason};${options.paymentCancellationReason}`
        : options.paymentCancellationReason;
      payment.errorCode = 'PENDING_GATEWAY_CANCEL';
      payment.errorMessage =
        'Payment invalidated due to appointment cancellation, pending gateway cancel';
      payment.lastErrorAt = cancelledAt;
    }

    if (pendingPayments.length > 0) {
      await manager.save(Payment, pendingPayments);
    }

    await manager.save(Appointment, appointment);

    this.syncCancellationFields(options.appointment, appointment);
    if (options.additionalUpdates) {
      Object.assign(options.appointment, options.additionalUpdates);
    }

    return {
      appointmentId: appointment.id,
      cleanupVideo: appointment.appointmentType === AppointmentTypeEnum.VIDEO,
      roomToDelete:
        appointment.appointmentType === AppointmentTypeEnum.VIDEO
          ? appointment.dailyCoChannel
          : null,
      paymentGatewayReason: options.paymentCancellationReason,
      paymentsToCancel: pendingPayments.map((payment) => ({
        paymentId: payment.id,
        orderCode: payment.orderCode,
      })),
    };
  }

  schedulePostCommitEffects(
    effects: AppointmentCancellationPostCommitEffect[],
  ): void {
    if (effects.length === 0) {
      return;
    }

    setImmediate(() => {
      void this.runPostCommitEffects(effects);
    });
  }

  private syncCancellationFields(
    target: Appointment,
    source: Appointment,
  ): void {
    target.status = source.status;
    target.cancelledAt = source.cancelledAt;
    target.cancellationReason = source.cancellationReason;
    target.cancelledBy = source.cancelledBy;
    target.cancelledMinutesBeforeStart = source.cancelledMinutesBeforeStart;
    target.paymentId = source.paymentId;
  }

  private async runPostCommitEffects(
    effects: AppointmentCancellationPostCommitEffect[],
  ): Promise<void> {
    const videoEffects = new Map<
      string,
      AppointmentCancellationPostCommitEffect
    >();
    const paymentTargets = new Map<
      string,
      PaymentGatewayCancellationTarget & { reason: string }
    >();

    for (const effect of effects) {
      if (effect.cleanupVideo && !videoEffects.has(effect.appointmentId)) {
        videoEffects.set(effect.appointmentId, effect);
      }

      for (const payment of effect.paymentsToCancel) {
        if (!paymentTargets.has(payment.paymentId)) {
          paymentTargets.set(payment.paymentId, {
            ...payment,
            reason: effect.paymentGatewayReason,
          });
        }
      }
    }

    for (const effect of videoEffects.values()) {
      try {
        if (effect.roomToDelete) {
          await this.dailyService.deleteRoom(effect.roomToDelete);
        }

        await this.callStateService.clearCallsForAppointment(
          effect.appointmentId,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup video state for appointment ${effect.appointmentId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    for (const payment of paymentTargets.values()) {
      const orderCode = Number(payment.orderCode);
      if (!Number.isFinite(orderCode)) {
        this.logger.warn(
          `Skipping gateway cancel for payment ${payment.paymentId} because order code is invalid`,
        );
        continue;
      }

      try {
        await this.payosService.cancelPaymentLink(orderCode, payment.reason);
        await this.dataSource.getRepository(Payment).update(payment.paymentId, {
          errorCode: null,
          errorMessage: null,
        });
      } catch (error) {
        this.logger.error(
          `Failed to cancel payment ${payment.paymentId} on gateway: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
