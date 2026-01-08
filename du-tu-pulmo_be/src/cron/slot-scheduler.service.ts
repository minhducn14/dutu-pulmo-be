import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DoctorScheduleService } from '../modules/doctor/doctor-schedule.service';

@Injectable()
export class SlotSchedulerService {
  private readonly logger = new Logger(SlotSchedulerService.name);

  constructor(
    private readonly doctorScheduleService: DoctorScheduleService,
  ) {}

  /**
   * Cron job chạy lúc 00:05 mỗi ngày
   * 1. Disable TẤT CẢ slots đã qua (có booking hoặc không)
   * 2. Generate slots mới cho ngày tiếp theo (rolling 7-day window)
   */
  @Cron('0 5 0 * * *', {
    name: 'daily-slot-maintenance',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async handleDailySlotMaintenance(): Promise<void> {
    this.logger.log('🕐 Starting daily slot maintenance...');
    const startTime = Date.now();

    try {
      // 1. Disable TẤT CẢ slots đã qua (dù có booking hay không)
      const disabledCount = await this.doctorScheduleService.disableOldSlots();
      this.logger.log(`✅ Disabled ${disabledCount} old slots (past time)`);

      // 2. Generate slots cho ngày tiếp theo
      const result = await this.doctorScheduleService.generateSlotsForNextDay();
      this.logger.log(
        `✅ Generated ${result.slotsGenerated} slots for ${result.doctorsProcessed} doctors`,
      );

      const duration = Date.now() - startTime;
      this.logger.log(
        `🎉 Daily slot maintenance completed in ${duration}ms. ` +
        `Disabled: ${disabledCount}, Generated: ${result.slotsGenerated}`,
      );
    } catch (error) {
      this.logger.error('❌ Daily slot maintenance failed:', error);
    }
  }

  /**
   * Manual trigger for slot maintenance (for testing/debugging)
   */
  async runManualMaintenance(): Promise<{
    disabledSlots: number;
    doctorsProcessed: number;
    slotsGenerated: number;
  }> {
    this.logger.log('🔧 Running manual slot maintenance...');

    const disabledSlots = await this.doctorScheduleService.disableOldSlots();
    const result = await this.doctorScheduleService.generateSlotsForNextDay();

    return {
      disabledSlots,
      doctorsProcessed: result.doctorsProcessed,
      slotsGenerated: result.slotsGenerated,
    };
  }
}
