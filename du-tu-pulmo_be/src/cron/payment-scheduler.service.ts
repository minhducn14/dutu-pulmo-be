import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentService } from '../modules/payment/payment.service';

@Injectable()
export class PaymentSchedulerService {
  private readonly logger = new Logger(PaymentSchedulerService.name);
  private isExpireJobRunning = false; // 🆕 Prevent concurrent runs

  constructor(private readonly paymentService: PaymentService) {}

  // /**
  //  * Auto-expire old pending payments
  //  * Runs every 15 minutes (more reasonable than every 5 minutes)
  //  * PayOS payments expire after 15 minutes anyway
  //  */
  // @Cron('*/15 * * * *', {
  //   name: 'expire-payments',
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  // async expireOldPayments() {
  //   if (this.isExpireJobRunning) {
  //     this.logger.warn('⚠️ Expire job already running, skipping...');
  //     return;
  //   }

  //   this.isExpireJobRunning = true;
  //   const startTime = Date.now();

  //   try {
  //     this.logger.log('🚀 Starting payment expiration job...');
      
  //     const count = await this.paymentService.expireOldPayments();
      
  //     const duration = Date.now() - startTime;
      
  //     if (count > 0) {
  //       this.logger.log(
  //         `Expired ${count} old payments in ${duration}ms`,
  //       );
  //     } else {
  //       this.logger.debug(
  //         `Payment expiration job completed in ${duration}ms (0 expired)`,
  //       );
  //     }
  //   } catch (error) {
  //     const duration = Date.now() - startTime;
  //     this.logger.error(
  //       `❌ Error expiring old payments after ${duration}ms: ${error instanceof Error ? error.message : String(error)}`,
  //     );
      
  //     // this.monitoringService.captureException(error);
  //   } finally {
  //     this.isExpireJobRunning = false;
  //   }
  // }

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

  // /**
  //  * 🆕 Anonymize expired sensitive data
  //  * Runs daily at 2 AM
  //  * GDPR compliance: Remove PII after retention period
  //  */
  // @Cron(CronExpression.EVERY_DAY_AT_2AM, {
  //   name: 'anonymize-payment-data',
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  // async anonymizeExpiredData() {
  //   try {
  //     this.logger.log('🔐 Starting data anonymization job...');
      
  //     const count = await this.paymentService.anonymizeExpiredData();
      
  //     if (count > 0) {
  //       this.logger.log(`✅ Anonymized ${count} expired payment records`);
  //     }
  //   } catch (error) {
  //     this.logger.error(
  //       `❌ Error anonymizing data: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }

  // /**
  //  * 🆕 Cleanup very old completed payments
  //  * Runs weekly on Sunday at 3 AM
  //  * Archive payments older than 1 year to cold storage
  //  */
  // @Cron('0 3 * * 0', {
  //   name: 'archive-old-payments',
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  // async archiveOldPayments() {
  //   try {
  //     this.logger.log('📦 Starting payment archival job...');
      
  //     const count = await this.paymentService.archiveOldPayments();
      
  //     if (count > 0) {
  //       this.logger.log(`✅ Archived ${count} old payment records`);
  //     }
  //   } catch (error) {
  //     this.logger.error(
  //       `❌ Error archiving payments: ${error instanceof Error ? error.message : String(error)}`,
  //     );
  //   }
  // }
}