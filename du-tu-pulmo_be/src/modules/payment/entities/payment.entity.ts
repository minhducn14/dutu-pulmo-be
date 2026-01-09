import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { Appointment } from '../../appointment/entities/appointment.entity';
import * as crypto from 'crypto';

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

// Type for safe webhook metadata
export interface WebhookMetadata {
  code: string;
  desc: string;
  orderCode: number;
  receivedAt: string;
}

@Entity('payments')
@Index(['orderCode'], { unique: true })
@Index(['appointmentId'])
@Index(['status'])
@Index(['createdAt'])
@Index(['paidAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_code', type: 'bigint', unique: true })
  orderCode: string;

  @ManyToOne(() => Appointment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string;

  @Column({ type: 'bigint' })
  amount: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  // ========================================
  // PAYOS PAYMENT LINK INFO
  // ========================================
  @Column({ name: 'payment_link_id', length: 100, nullable: true })
  paymentLinkId: string;

  @Column({ name: 'checkout_url', type: 'text', nullable: true })
  checkoutUrl: string;

  @Column({ name: 'qr_code', type: 'text', nullable: true })
  qrCode: string;

  @Column({ name: 'bin', length: 20, nullable: true })
  bin: string;

  @Column({ name: 'account_number', length: 50, nullable: true })
  accountNumber: string;

  @Column({ name: 'account_name', length: 255, nullable: true })
  accountName: string;

  // ========================================
  // TRANSACTION INFO
  // ========================================
  @Column({ name: 'transaction_reference', length: 100, nullable: true })
  transactionReference: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ name: 'counter_account_bank_id', length: 20, nullable: true })
  counterAccountBankId: string;

  @Column({ name: 'counter_account_bank_name', length: 255, nullable: true })
  counterAccountBankName: string;

  @Column({ name: 'counter_account_name', length: 255, nullable: true })
  counterAccountName: string;

  // SECURITY: Masked account number instead of raw
  @Column({ name: 'counter_account_number_masked', length: 20, nullable: true })
  counterAccountNumberMasked: string;

  @Column({ name: 'virtual_account_name', length: 255, nullable: true })
  virtualAccountName: string;

  @Column({ name: 'virtual_account_number', length: 50, nullable: true })
  virtualAccountNumber: string;

  // ========================================
  // CANCELLATION INFO
  // ========================================
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ name: 'cancelled_by', type: 'uuid', nullable: true })
  cancelledBy: string;

  // ========================================
  // EXPIRATION
  // ========================================
  @Column({ name: 'expired_at', type: 'timestamptz', nullable: true })
  expiredAt: Date;

  // ========================================
  // WEBHOOK TRACKING - SECURITY: Safe metadata only
  // ========================================
  @Column({ name: 'webhook_received_at', type: 'timestamptz', nullable: true })
  webhookReceivedAt: Date;

  @Column({
    name: 'webhook_metadata',
    type: 'jsonb',
    nullable: true,
  })
  webhookMetadata: WebhookMetadata;

  @Column({
    name: 'webhook_retry_count',
    type: 'integer',
    default: 0,
  })
  webhookRetryCount: number;

  // ========================================
  // ERROR TRACKING
  // ========================================
  @Column({ name: 'error_code', length: 50, nullable: true })
  errorCode: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'last_error_at', type: 'timestamptz', nullable: true })
  lastErrorAt: Date;

  // ========================================
  // BUYER INFO - SECURITY: Only name, no raw email/phone
  // ========================================
  @Column({ name: 'buyer_name', length: 255, nullable: true })
  buyerName: string;

  // ========================================
  // AUDIT TRAIL - SECURITY: Anonymized data
  // ========================================
  @Column({
    name: 'request_country',
    length: 2,
    nullable: true,
  })
  requestCountry: string;

  @Column({
    name: 'ip_address_hash',
    length: 64,
    nullable: true,
    select: false,
  })
  ipAddressHash: string;

  @Column({
    name: 'browser_type',
    length: 50,
    nullable: true,
  })
  browserType: string;

  @Column({
    name: 'device_type',
    length: 20,
    nullable: true,
  })
  deviceType: string;

  // ========================================
  // DATA RETENTION
  // ========================================
  @Column({
    name: 'sensitive_data_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  sensitiveDataExpiresAt: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;

  // ========================================
  // LIFECYCLE HOOKS
  // ========================================
  @BeforeInsert()
  setDataRetention() {
    if (!this.sensitiveDataExpiresAt) {
      // 90 days data retention
      this.sensitiveDataExpiresAt = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000,
      );
    }
  }

  // ========================================
  // STATIC HELPER METHODS
  // ========================================

  /**
   * Mask account number - show only last 4 digits
   */
  static maskAccountNumber(accountNumber: string): string {
    if (!accountNumber || accountNumber.length < 4) return '****';
    return '****' + accountNumber.slice(-4);
  }

  /**
   * Hash IP address using SHA-256
   */
  static hashIpAddress(ip: string): string {
    if (!ip) return '';
    return crypto.createHash('sha256').update(ip).digest('hex');
  }

  /**
   * Parse user agent to extract browser and device type
   */
  static parseUserAgent(userAgent: string): {
    browserType: string;
    deviceType: string;
  } {
    if (!userAgent) {
      return { browserType: 'unknown', deviceType: 'unknown' };
    }

    const ua = userAgent.toLowerCase();

    let browserType = 'other';
    if (ua.includes('chrome') && !ua.includes('edge')) browserType = 'chrome';
    else if (ua.includes('safari') && !ua.includes('chrome'))
      browserType = 'safari';
    else if (ua.includes('firefox')) browserType = 'firefox';
    else if (ua.includes('edge')) browserType = 'edge';
    else if (ua.includes('opera')) browserType = 'opera';

    const deviceType =
      ua.includes('mobile') || ua.includes('android') ? 'mobile' : 'desktop';

    return { browserType, deviceType };
  }
}
