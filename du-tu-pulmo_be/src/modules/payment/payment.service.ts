import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { PayosService, WebhookData } from './payos.service';
import { Appointment } from '../appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '../common/enums/appointment-status.enum';

export interface CreatePaymentDto {
  appointmentId: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResponseDto {
  id: string;
  orderCode: string;
  amount: string;
  description: string;
  status: PaymentStatus;
  checkoutUrl: string;
  qrCode: string;
  appointmentId: string;
  paidAt?: Date;
  expiredAt?: Date;
  cancellationReason?: string;
  counterAccount?: {
    bankId: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
  };
  createdAt: Date;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly payosService: PayosService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a payment for an appointment with buyer tracking
   */
  async createPaymentForAppointment(
    dto: CreatePaymentDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PaymentResponseDto> {
    const { appointmentId } = dto;

    // Find appointment with patient info
    const appointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId },
      relations: [
        'patient',
        'patient.user',
        'patient.user.account',
        'doctor',
        'doctor.user',
      ],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== AppointmentStatusEnum.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Cannot create payment for appointment with status: ${appointment.status}`,
      );
    }

    // Check if payment already exists
    const existingPayment = await this.paymentRepository.findOne({
      where: { appointmentId, status: PaymentStatus.PENDING },
    });

    if (existingPayment) {
      return this.toDto(existingPayment);
    }

    // Generate order code
    const orderCode = this.payosService.generateorderCode();
    // Build payment description
    const doctorName = appointment.doctor?.user?.fullName || 'Bác sĩ';
    const description = `Thanh toán lịch hẹn ${appointment.appointmentNumber}`;

    // Get URLs from config
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';
    const returnUrl = dto.returnUrl || `${frontendUrl}/payment/success`;
    const cancelUrl = dto.cancelUrl || `${frontendUrl}/payment/cancel`;

    // Get buyer info
    const buyerName = appointment.patient?.user?.fullName;
    const buyerEmail = appointment.patient?.user?.account?.email;
    const buyerPhone = appointment.patient?.user?.phone;

    // Create payment link via PayOS
    const paymentLink = await this.payosService.createPaymentLink({
      orderCode,
      // amount: Number(appointment.feeAmount),
      amount: 2001,
      description: description.substring(0, 25),
      buyerName,
      buyerEmail,
      buyerPhone,
      items: [
        {
          name: `Khám bệnh - ${doctorName}`.substring(0, 50),
          quantity: 1,
          price: Number(appointment.feeAmount),
        },
      ],
      returnUrl,
      cancelUrl,
      expiredAt: Math.floor(Date.now() / 1000) + 15 * 60,
    });

    // Create payment record with SECURITY: anonymized audit trail
    const { browserType, deviceType } = userAgent
      ? Payment.parseUserAgent(userAgent)
      : { browserType: undefined, deviceType: undefined };

    const payment = this.paymentRepository.create({
      orderCode: String(orderCode),
      appointmentId,
      amount: String(Math.floor(Number(appointment.feeAmount))),
      description,
      status: PaymentStatus.PENDING,
      paymentLinkId: paymentLink.paymentLinkId,
      checkoutUrl: paymentLink.checkoutUrl,
      qrCode: paymentLink.qrCode,
      bin: paymentLink.bin,
      accountNumber: paymentLink.accountNumber,
      accountName: paymentLink.accountName,
      expiredAt: new Date(Date.now() + 15 * 60 * 1000),
      // SECURITY: Only store buyer name, not email/phone
      buyerName,
      // SECURITY: Anonymized audit trail
      ipAddressHash: ipAddress ? Payment.hashIpAddress(ipAddress) : undefined,
      browserType,
      deviceType,
    });

    const saved = await this.paymentRepository.save(payment);

    // Update appointment with payment ID
    await this.appointmentRepository.update(appointmentId, {
      paymentId: saved.id,
    });

    this.logger.log(
      `Created payment ${saved.id} for appointment ${appointmentId}`,
    );

    return this.toDto(saved);
  }

  /**
   * Get payment by appointment ID
   */
  async getPaymentByAppointmentId(
    appointmentId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { appointmentId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this appointment');
    }

    return this.toDto(payment);
  }

  /**
   * Get payment by order code
   */
  async getPaymentByorderCode(orderCode: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { orderCode },
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    void this.cancelPaymentByAppointmentId(payment.appointmentId, '');
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toDto(payment);
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(id: string): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toDto(payment);
  }

  /**
   * Cancel a payment by appointment ID
   */
  async cancelPaymentByAppointmentId(
    appointmentId: string,
    reason?: string,
    cancelledBy?: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { appointmentId, status: PaymentStatus.PENDING },
    });

    if (!payment) {
      throw new NotFoundException(
        'Pending payment not found for this appointment',
      );
    }

    return this.cancelPaymentInternal(payment, reason, cancelledBy);
  }

  /**
   * Internal method to cancel a payment
   */
  private async cancelPaymentInternal(
    payment: Payment,
    reason?: string,
    cancelledBy?: string,
  ): Promise<PaymentResponseDto> {
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Cannot cancel payment with status: ${payment.status}`,
      );
    }

    // Cancel on PayOS
    await this.payosService.cancelPaymentLink(
      Number(payment.orderCode),
      reason,
    );

    // Update local record
    payment.status = PaymentStatus.CANCELLED;
    payment.cancelledAt = new Date();
    payment.cancellationReason = reason || 'User cancelled';
    if (cancelledBy) {
      payment.cancelledBy = cancelledBy;
    }

    const saved = await this.paymentRepository.save(payment);

    this.logger.log(`Cancelled payment ${payment.id}`);

    return this.toDto(saved);
  }

  /**
   * Handle webhook from PayOS with retry tracking
   */
  async handleWebhook(webhookData: WebhookData): Promise<void> {
    this.logger.log(
      `Received webhook for order ${webhookData.data?.orderCode}`,
    );

    // Verify webhook signature
    const verifiedData = this.payosService.verifyWebhookData(webhookData);
    if (!verifiedData) {
      this.logger.warn('Invalid webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    const { orderCode } = verifiedData;

    // Find payment
    const payment = await this.paymentRepository.findOne({
      where: { orderCode: String(orderCode) },
    });

    if (!payment) {
      this.logger.warn(`Payment not found for order ${orderCode}`);
      return;
    }

    // Update webhook tracking - SECURITY: Store safe metadata only
    payment.webhookReceivedAt = new Date();
    payment.webhookMetadata = {
      code: webhookData.code,
      desc: webhookData.desc,
      orderCode: webhookData.data?.orderCode,
      receivedAt: new Date().toISOString(),
    };
    payment.webhookRetryCount = (payment.webhookRetryCount || 0) + 1;

    try {
      // Check if already processed
      if (payment.status === PaymentStatus.PAID) {
        this.logger.log(`Payment ${payment.id} already marked as paid`);
        await this.paymentRepository.save(payment);
        return;
      }

      // Update payment status based on webhook
      if (webhookData.success && webhookData.code === '00') {
        await this.handlePaymentSuccess(payment, webhookData);
      } else {
        // Handle failed payment
        payment.status = PaymentStatus.FAILED;
        payment.errorCode = webhookData.code;
        payment.errorMessage = webhookData.desc;
        payment.lastErrorAt = new Date();
        await this.paymentRepository.save(payment);

        this.logger.log(
          `Webhook indicates payment failed: ${webhookData.code} - ${webhookData.desc}`,
        );
      }
    } catch (error) {
      // Track errors
      payment.lastErrorAt = new Date();
      payment.errorMessage =
        error instanceof Error ? error.message : String(error);
      await this.paymentRepository.save(payment);
      throw error;
    }
  }

  /**
   * Handle successful payment with better error handling
   */
  private async handlePaymentSuccess(
    payment: Payment,
    webhookData: WebhookData,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // Update payment
      payment.status = PaymentStatus.PAID;
      payment.paidAt = new Date(webhookData.data.transactionDateTime);
      payment.transactionReference = webhookData.data.reference;
      payment.counterAccountBankId = webhookData.data.counterAccountBankId;
      payment.counterAccountBankName = webhookData.data.counterAccountBankName;
      payment.counterAccountName = webhookData.data.counterAccountName;
      // SECURITY: Mask account number instead of storing raw
      payment.counterAccountNumberMasked = Payment.maskAccountNumber(
        webhookData.data.counterAccountNumber,
      );
      payment.virtualAccountName = webhookData.data.virtualAccountName;
      payment.virtualAccountNumber = webhookData.data.virtualAccountNumber;

      await manager.save(payment);

      // Update appointment status
      if (payment.appointmentId) {
        const appointment = await manager.findOne(Appointment, {
          where: { id: payment.appointmentId },
        });

        if (appointment) {
          appointment.status = AppointmentStatusEnum.CONFIRMED;
          appointment.paidAmount = payment.amount;
          await manager.save(appointment);

          this.logger.log(`Updated appointment ${appointment.id} to CONFIRMED`);
        }
      }

      this.logger.log(`Payment ${payment.id} marked as paid`);
    });
  }

  /**
   * Auto-expire old pending payments (called by cron job)
   */
  async expireOldPayments(): Promise<number> {
    const now = new Date();

    const expiredPayments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.PENDING,
        expiredAt: LessThan(now),
      },
    });

    let count = 0;

    for (const payment of expiredPayments) {
      payment.status = PaymentStatus.EXPIRED;
      await this.paymentRepository.save(payment);
      count++;

      this.logger.log(`Expired payment ${payment.id}`);
    }

    if (count > 0) {
      this.logger.log(`Expired ${count} old payments`);
    }

    return count;
  }

  /**
   * Sync payment status with PayOS by appointment ID
   */
  async syncPaymentStatusByAppointmentId(
    appointmentId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { appointmentId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found for this appointment');
    }

    return this.syncPaymentStatusInternal(payment);
  }

  /**
   * Sync payment status with PayOS by order code
   */
  async syncPaymentStatusByorderCode(
    orderCode: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentRepository.findOne({
      where: { orderCode },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.syncPaymentStatusInternal(payment);
  }

  /**
   * Internal method to sync payment status
   */
  private async syncPaymentStatusInternal(
    payment: Payment,
  ): Promise<PaymentResponseDto> {
    // Get latest status from PayOS
    const payosInfo = await this.payosService.getPaymentInfo(
      Number(payment.orderCode),
    );

    // Update local status if changed
    if (payosInfo.status === 'PAID' && payment.status !== PaymentStatus.PAID) {
      payment.status = PaymentStatus.PAID;
      payment.paidAt = new Date();

      await this.paymentRepository.save(payment);

      // Update appointment
      if (payment.appointmentId) {
        await this.appointmentRepository.update(payment.appointmentId, {
          status: AppointmentStatusEnum.CONFIRMED,
          paidAmount: payment.amount,
        });
      }
    } else if (
      payosInfo.status === 'CANCELLED' &&
      payment.status === PaymentStatus.PENDING
    ) {
      payment.status = PaymentStatus.CANCELLED;
      payment.cancelledAt = new Date(payosInfo.canceledAt || new Date());
      payment.cancellationReason = payosInfo.cancellationReason || 'Cancelled';

      await this.paymentRepository.save(payment);
    } else if (
      payosInfo.status === 'EXPIRED' &&
      payment.status === PaymentStatus.PENDING
    ) {
      payment.status = PaymentStatus.EXPIRED;
      await this.paymentRepository.save(payment);
    }

    return this.toDto(payment);
  }

  /**
   * Convert entity to DTO
   */
  private toDto(payment: Payment): PaymentResponseDto {
    const dto: PaymentResponseDto = {
      id: payment.id,
      orderCode: payment.orderCode,
      amount: payment.amount,
      description: payment.description,
      status: payment.status,
      checkoutUrl: payment.checkoutUrl,
      qrCode: payment.qrCode,
      appointmentId: payment.appointmentId,
      paidAt: payment.paidAt,
      expiredAt: payment.expiredAt,
      cancellationReason: payment.cancellationReason,
      createdAt: payment.createdAt,
    };

    // Add counter account info if paid (SECURITY: masked account number)
    if (
      payment.status === PaymentStatus.PAID &&
      payment.counterAccountBankName
    ) {
      dto.counterAccount = {
        bankId: payment.counterAccountBankId,
        bankName: payment.counterAccountBankName,
        accountName: payment.counterAccountName,
        accountNumber: payment.counterAccountNumberMasked,
      };
    }

    return dto;
  }

  /**
   * Sync pending payments with PayOS - catch webhook misses
   */
  async syncPendingPayments(): Promise<number> {
    const pendingPayments = await this.paymentRepository.find({
      where: {
        status: In([PaymentStatus.PENDING, PaymentStatus.PROCESSING]),
      },
      order: { createdAt: 'DESC' },
      take: 100,
    });

    let syncedCount = 0;

    for (const payment of pendingPayments) {
      try {
        const payosInfo = await this.payosService.getPaymentInfo(
          Number(payment.orderCode),
        );

        let statusChanged = false;

        if (
          payosInfo.status === 'PAID' &&
          payment.status !== PaymentStatus.PAID
        ) {
          payment.status = PaymentStatus.PAID;
          payment.paidAt = new Date();
          statusChanged = true;

          // Update appointment
          if (payment.appointmentId) {
            await this.appointmentRepository.update(payment.appointmentId, {
              status: AppointmentStatusEnum.CONFIRMED,
              paidAmount: payment.amount,
            });
          }
        } else if (
          payosInfo.status === 'CANCELLED' &&
          payment.status !== PaymentStatus.CANCELLED
        ) {
          console.log('Payment cancelled: ' + payment.id);
          payment.status = PaymentStatus.CANCELLED;
          payment.cancelledAt = new Date();
          statusChanged = true;
        } else if (
          payosInfo.status === 'EXPIRED' &&
          payment.status !== PaymentStatus.EXPIRED
        ) {
          console.log('Payment expired: ' + payment.id);
          payment.status = PaymentStatus.EXPIRED;
          statusChanged = true;
        }

        if (statusChanged) {
          await this.paymentRepository.save(payment);
          syncedCount++;
          this.logger.log(`Synced payment ${payment.id} to ${payment.status}`);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to sync payment ${payment.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return syncedCount;
  }

  /**
   * Anonymize expired sensitive data - GDPR compliance
   */
  async anonymizeExpiredData(): Promise<number> {
    const now = new Date();

    const paymentsToAnonymize = await this.paymentRepository.find({
      where: {
        sensitiveDataExpiresAt: LessThan(now),
      },
    });

    let count = 0;

    for (const payment of paymentsToAnonymize) {
      // Anonymize sensitive fields
      payment.buyerName = '***ANONYMIZED***';
      payment.ipAddressHash = undefined as unknown as string;
      payment.browserType = undefined as unknown as string;
      payment.deviceType = undefined as unknown as string;
      payment.requestCountry = undefined as unknown as string;
      payment.counterAccountNumberMasked = '****';
      payment.webhookMetadata =
        undefined as unknown as Payment['webhookMetadata'];
      payment.sensitiveDataExpiresAt = undefined as unknown as Date;

      await this.paymentRepository.save(payment);
      count++;
    }

    if (count > 0) {
      this.logger.log(`Anonymized ${count} payment records`);
    }

    return count;
  }

  /**
   * Archive old completed payments (>1 year)
   */
  async archiveOldPayments(): Promise<number> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const oldPayments = await this.paymentRepository.find({
      where: {
        status: In([
          PaymentStatus.PAID,
          PaymentStatus.CANCELLED,
          PaymentStatus.EXPIRED,
        ]),
        createdAt: LessThan(oneYearAgo),
      },
    });

    let count = 0;

    for (const payment of oldPayments) {
      this.logger.debug(`Would archive payment ${payment.id}`);
      count++;
    }

    return count;
  }
}
