import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PayOS } from '@payos/node';

export interface PaymentData {
  orderCode: number;
  amount: number;
  description: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerAddress?: string;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  returnUrl: string;
  cancelUrl: string;
  expiredAt?: number;
}

export interface PaymentLinkResponse {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: string;
  checkoutUrl: string;
  qrCode: string;
}

export interface PaymentInfo {
  id: string;
  orderCode: number;
  amount: number;
  amountPaid: number;
  amountRemaining: number;
  status: string;
  createdAt: string;
  transactions: Array<{
    reference: string;
    amount: number;
    accountNumber: string;
    description: string;
    transactionDateTime: string;
    virtualAccountName: string;
    virtualAccountNumber: string;
    counterAccountBankId: string;
    counterAccountBankName: string;
    counterAccountName: string;
    counterAccountNumber: string;
  }>;
  cancellationReason: string | null;
  canceledAt: string | null;
}

export interface WebhookData {
  code: string;
  desc: string;
  success: boolean;
  data: {
    orderCode: number;
    amount: number;
    description: string;
    accountNumber: string;
    reference: string;
    transactionDateTime: string;
    currency: string;
    paymentLinkId: string;
    code: string;
    desc: string;
    counterAccountBankId: string;
    counterAccountBankName: string;
    counterAccountName: string;
    counterAccountNumber: string;
    virtualAccountName: string;
    virtualAccountNumber: string;
  };
  signature: string;
}

@Injectable()
export class PayosService implements OnModuleInit {
  private readonly logger = new Logger(PayosService.name);
  private payOS: PayOS | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const clientId = this.configService.get<string>('PAYOS_CLIENT_ID');
    const apiKey = this.configService.get<string>('PAYOS_API_KEY');
    const checksumKey = this.configService.get<string>('PAYOS_CHECKSUM_KEY');

    if (!clientId || !apiKey || !checksumKey) {
      this.logger.warn(
        'PayOS credentials not configured. Payment features will be disabled.',
      );
      return;
    }

    this.payOS = new PayOS({
      clientId,
      apiKey,
      checksumKey,
    });
    this.logger.log('PayOS initialized successfully');
  }

  /**
   * Generate unique order code for payment
   */
  generateorderCode(): number {
    // Use timestamp + random number to ensure uniqueness
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    // Keep it under Number.MAX_SAFE_INTEGER and positive
    return Number(
      String(timestamp).slice(-10) + String(random).padStart(3, '0'),
    );
  }

  /**
   * Create a payment link for an order
   * Uses new SDK: payOS.paymentRequests.create()
   */
  async createPaymentLink(
    paymentData: PaymentData,
  ): Promise<PaymentLinkResponse> {
    if (!this.payOS) {
      throw new Error('PayOS is not initialized. Check your configuration.');
    }

    try {
      const result = await this.payOS.paymentRequests.create(paymentData);
      this.logger.log(
        `Created payment link for order ${paymentData.orderCode}`,
      );
      return result as unknown as PaymentLinkResponse;
    } catch (error) {
      this.logger.error(`Failed to create payment link: ${error}`);
      throw error;
    }
  }

  /**
   * Get payment information by order code
   * Uses new SDK: payOS.paymentRequests.get()
   */
  async getPaymentInfo(orderCode: number): Promise<PaymentInfo> {
    if (!this.payOS) {
      throw new Error('PayOS is not initialized. Check your configuration.');
    }

    try {
      const result = await this.payOS.paymentRequests.get(orderCode);
      return result as unknown as PaymentInfo;
    } catch (error) {
      this.logger.error(
        `Failed to get payment info for order ${orderCode}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Cancel a payment link
   * Uses new SDK: payOS.paymentRequests.cancel()
   */
  async cancelPaymentLink(
    orderCode: number,
    cancellationReason?: string,
  ): Promise<PaymentInfo> {
    if (!this.payOS) {
      throw new Error('PayOS is not initialized. Check your configuration.');
    }

    try {
      const result = await this.payOS.paymentRequests.cancel(
        orderCode,
        cancellationReason,
      );
      this.logger.log(`Cancelled payment link for order ${orderCode}`);
      return result as unknown as PaymentInfo;
    } catch (error) {
      this.logger.error(
        `Failed to cancel payment link for order ${orderCode}: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Verify webhook signature
   * Uses new SDK: payOS.webhooks.verify()
   */
  verifyWebhookData(webhookBody: WebhookData): WebhookData['data'] | null {
    if (!this.payOS) {
      throw new Error('PayOS is not initialized. Check your configuration.');
    }

    try {
      const verifiedData = this.payOS.webhooks.verify(webhookBody);
      return verifiedData as unknown as WebhookData['data'];
    } catch (error) {
      this.logger.error(`Failed to verify webhook: ${error}`);
      return null;
    }
  }
}
