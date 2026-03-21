import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DoctorScheduleService } from '@/modules/doctor/services/doctor-schedule.service';

@Injectable()
export class SlotSchedulerService {
  private readonly logger = new Logger(SlotSchedulerService.name);

  constructor(private readonly doctorScheduleService: DoctorScheduleService) {}

  /**
   * Cron job chạy lúc 00:05 mỗi ngày
   * Disable TẤT CẢ slots đã qua thời gian hiện tại
   */
  @Cron('0 5 0 * * *', {
    name: 'daily-slot-cleanup',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailySlotCleanup(): Promise<void> {
    this.logger.log('🕐 Starting daily slot cleanup...');
    const startTime = Date.now();

    try {
      const disabledCount = await this.doctorScheduleService.disableOldSlots();
      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Disabled ${disabledCount} old slots (past time) in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('❌ Daily slot cleanup failed:', error);
    }
  }

  /**
   * Cron job chạy lúc 00:10 mỗi ngày
   * Generate slots cho NGÀY MAI
   */
  @Cron('0 10 0 * * *', {
    name: 'daily-slot-generation',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailySlotGeneration(): Promise<void> {
    this.logger.log('📅 Starting daily slot generation...');
    const startTime = Date.now();

    try {
      const result = await this.doctorScheduleService.generateSlotsForNextDay();
      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Generated ${result.slotsGenerated} slots for ` +
          `${result.doctorsProcessed} doctors in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('❌ Daily slot generation failed:', error);
    }
  }

  /**
   * Cron job chạy lúc 01:05 ngày 1 hàng tháng
   * Generate slots cho TOÀN BỘ tháng sau
   */
  @Cron('0 5 1 * * *', {
    name: 'monthly-slot-generation',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleMonthlySlotGeneration(): Promise<void> {
    this.logger.log('📅 Starting monthly slot generation for next month...');
    const startTime = Date.now();

    try {
      const result =
        await this.doctorScheduleService.generateSlotsForNextMonth();
      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ Generated ${result.slotsGenerated} slots for ${result.doctorsProcessed} doctors for next month in ${duration}ms`,
      );
    } catch (error) {
      this.logger.error('❌ Monthly slot generation failed:', error);
    }
  }

  /**
   * Manual trigger for full slot maintenance (cleanup + next month generation)
   */
  async runManualMaintenance(): Promise<{
    disabledSlots: number;
    doctorsProcessed: number;
    slotsGeneratedMonthly: number;
  }> {
    this.logger.log('🔧 Running manual slot maintenance...');

    const disabledSlots = await this.doctorScheduleService.disableOldSlots();
    const monthlyResult =
      await this.doctorScheduleService.generateSlotsForNextMonth();

    return {
      disabledSlots,
      doctorsProcessed: monthlyResult.doctorsProcessed,
      slotsGeneratedMonthly: monthlyResult.slotsGenerated,
    };
  }
}
