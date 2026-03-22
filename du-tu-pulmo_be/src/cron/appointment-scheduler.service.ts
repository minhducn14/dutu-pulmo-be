import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, Not, IsNull } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { DailyService } from '@/modules/video_call/daily.service';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { MedicalRecordStatusEnum } from '@/modules/common/enums/medical-record-status.enum';
import { startOfDayVN, vnNow } from '@/common/datetime';
import { DataSource } from 'typeorm';
import { AppointmentCheckinService } from '@/modules/appointment/services/appointment-checkin.service';

@Injectable()
export class AppointmentSchedulerService {
  private readonly logger = new Logger(AppointmentSchedulerService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(MedicalRecord)
    private readonly dailyService: DailyService,

    private readonly appointmentCheckinService: AppointmentCheckinService,
  ) {}

  /**
   * Clean up video rooms 24h after appointment ended
   * Runs every hour at minute 0
   */
  @Cron('0 * * * *', {
    name: 'cleanup-video-rooms',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async cleanupOldVideoRooms() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const oldAppointments = await this.appointmentRepository.find({
        where: {
          appointmentType: AppointmentTypeEnum.VIDEO,
          status: In([
            AppointmentStatusEnum.COMPLETED,
            AppointmentStatusEnum.CANCELLED,
          ]),
          endedAt: LessThan(yesterday),
          dailyCoChannel: Not(IsNull()),
        },
      });

      if (oldAppointments.length === 0) {
        return;
      }

      this.logger.log(
        `🧹 Found ${oldAppointments.length} old video rooms to cleanup`,
      );

      for (const appointment of oldAppointments) {
        try {
          await this.dailyService.deleteRoom(appointment.dailyCoChannel!);

          await this.appointmentRepository.update(appointment.id, {
            dailyCoChannel: null,
            meetingUrl: null,
            meetingRoomId: null,
          });

          this.logger.log(
            `✅ Cleaned up video room for appointment ${appointment.id}`,
          );
        } catch (error) {
          this.logger.warn(
            `⚠️ Failed to cleanup room for appointment ${appointment.id}: ${error}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error in cleanupOldVideoRooms: ${error}`);
    }
  }

  // /**
  //  * Send reminders 24h before appointment
  //  * Runs every hour at minute 15
  //  */
  // @Cron('15 * * * *', {
  //   name: 'reminder-24h',
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  // async sendReminders24h() {
  //   const now = new Date();
  //   const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  //   const in23h = new Date(now.getTime() + 23 * 60 * 60 * 1000);

  //   try {
  //     const appointments = await this.appointmentRepository.find({
  //       where: {
  //         status: AppointmentStatusEnum.CONFIRMED,
  //         scheduledAt: LessThan(in24h),
  //         reminder24hSent: false,
  //       },
  //       relations: ['patient', 'doctor'],
  //     });

  //     // Filter to only those within 23-24h window
  //     const toRemind = appointments.filter(
  //       (a) => a.scheduledAt > in23h && a.scheduledAt <= in24h,
  //     );

  //     if (toRemind.length === 0) {
  //       return;
  //     }

  //     this.logger.log(
  //       `📨 Sending 24h reminders for ${toRemind.length} appointments`,
  //     );

  //     for (const appointment of toRemind) {
  //       try {
  //         // TODO: Send notification via NotificationService
  //         // await this.notificationService.sendAppointmentReminder(appointment, '24h');

  //         await this.appointmentRepository.update(appointment.id, {
  //           reminder24hSent: true,
  //         });

  //         this.logger.log(
  //           `✅ Sent 24h reminder for appointment ${appointment.id}`,
  //         );
  //       } catch (error) {
  //         this.logger.warn(
  //           `⚠️ Failed to send reminder for appointment ${appointment.id}: ${error}`,
  //         );
  //       }
  //     }
  //   } catch (error) {
  //     this.logger.error(`❌ Error in sendReminders24h: ${error}`);
  //   }
  // }

  // /**
  //  * Send reminders 1h before appointment
  //  * Runs every 15 minutes
  //  */
  // @Cron('*/15 * * * *', {
  //   name: 'reminder-1h',
  //   timeZone: 'Asia/Ho_Chi_Minh',
  // })
  // async sendReminders1h() {
  //   const now = new Date();
  //   const in1h = new Date(now.getTime() + 60 * 60 * 1000);
  //   const in45m = new Date(now.getTime() + 45 * 60 * 1000);

  //   try {
  //     const appointments = await this.appointmentRepository.find({
  //       where: {
  //         status: AppointmentStatusEnum.CONFIRMED,
  //         scheduledAt: LessThan(in1h),
  //         reminder1hSent: false,
  //       },
  //       relations: ['patient', 'doctor'],
  //     });

  //     // Filter to only those within 45m-1h window
  //     const toRemind = appointments.filter(
  //       (a) => a.scheduledAt > in45m && a.scheduledAt <= in1h,
  //     );

  //     if (toRemind.length === 0) {
  //       return;
  //     }

  //     this.logger.log(
  //       `📨 Sending 1h reminders for ${toRemind.length} appointments`,
  //     );

  //     for (const appointment of toRemind) {
  //       try {
  //         // TODO: Send notification via NotificationService
  //         // await this.notificationService.sendAppointmentReminder(appointment, '1h');

  //         await this.appointmentRepository.update(appointment.id, {
  //           reminder1hSent: true,
  //         });

  //         this.logger.log(
  //           `✅ Sent 1h reminder for appointment ${appointment.id}`,
  //         );
  //       } catch (error) {
  //         this.logger.warn(
  //           `⚠️ Failed to send reminder for appointment ${appointment.id}: ${error}`,
  //         );
  //       }
  //     }
  //   } catch (error) {
  //     this.logger.error(`❌ Error in sendReminders1h: ${error}`);
  //   }
  // }

  /**
   * Auto-complete appointments from previous days
   * Runs every day at 00:00 VN time
   */
  @Cron('0 0 * * *', {
    name: 'auto-complete-past-appointments',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async autoCompletePastAppointments() {
    const startOfToday = startOfDayVN(vnNow());

    try {
      const pastAppointments = await this.appointmentRepository.find({
        where: {
          scheduledAt: LessThan(startOfToday),
          status: In([
            AppointmentStatusEnum.PENDING,
            AppointmentStatusEnum.PENDING_PAYMENT,
            AppointmentStatusEnum.CONFIRMED,
            AppointmentStatusEnum.CHECKED_IN,
            AppointmentStatusEnum.IN_PROGRESS,
          ]),
        },
      });

      if (pastAppointments.length === 0) {
        return;
      }

      this.logger.log(
        `🤖 Found ${pastAppointments.length} past appointments to auto-complete`,
      );

      for (const appointment of pastAppointments) {
        try {
          await this.appointmentCheckinService.completeExamination(
            appointment.id,
            {},
          );

          this.logger.log(`✅ Auto-completed appointment ${appointment.id}`);
        } catch (error) {
          this.logger.error(
            `❌ Failed to auto-complete appointment ${appointment.id}: ${error}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error in autoCompletePastAppointments: ${error}`);
    }
  }
}
