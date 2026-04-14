import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentService } from '@/modules/payment/payment.service';

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);

  constructor(private readonly paymentService: PaymentService) {}

  /**
   * Sync pending payments with PayOS
   * Runs every 30 minutes
   * Useful for catching webhook misses
   */
  @Cron('*/30 * * * *', {
    name: 'sync-payments',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async syncPendingPayments() {
    try {
      this.logger.log('Starting payment sync job...');

      const count = await this.paymentService.syncPendingPayments();

      if (count > 0) {
        this.logger.log(`Synced ${count} pending payments`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Error syncing payments: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
