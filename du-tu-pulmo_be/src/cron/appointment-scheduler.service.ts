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
    private readonly dailyService: DailyService,
    private readonly dataSource: DataSource,
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

  /**
   * Auto-complete appointments from previous days
   * Runs every day at 00:25 VN time
   */
  @Cron('33  0 * * *', {
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
          if (
            [
              AppointmentStatusEnum.PENDING,
              AppointmentStatusEnum.PENDING_PAYMENT,
            ].includes(appointment.status)
          ) {
            await this.appointmentRepository.update(appointment.id, {
              status: AppointmentStatusEnum.CANCELLED,
            });
            this.logger.log(`✅ Auto-cancelled appointment ${appointment.id}`);
          } else if (appointment.status === AppointmentStatusEnum.CONFIRMED) {
            await this.appointmentRepository.update(appointment.id, {
              status: AppointmentStatusEnum.NO_SHOW,
            });
            this.logger.log(
              `✅ Marked appointment ${appointment.id} as NO_SHOW`,
            );
          } else if (
            [
              AppointmentStatusEnum.CHECKED_IN,
              AppointmentStatusEnum.IN_PROGRESS,
            ].includes(appointment.status)
          ) {
            await this.dataSource.transaction(async (manager) => {
              // 1. Update Appointment Status
              await manager.update(Appointment, appointment.id, {
                status: AppointmentStatusEnum.COMPLETED,
                endedAt: appointment.endedAt || new Date(),
              });

              // 2. Update Medical Record Status if exists
              await manager.update(
                MedicalRecord,
                { appointmentId: appointment.id },
                { status: MedicalRecordStatusEnum.COMPLETED },
              );

              // 3. Cleanup video room if video appointment
              if (
                appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
                appointment.dailyCoChannel
              ) {
                try {
                  await this.dailyService.deleteRoom(
                    appointment.dailyCoChannel,
                  );
                } catch (e) {
                  this.logger.warn(
                    `Failed to delete room for ${appointment.id}`,
                  );
                }
              }
            });
            this.logger.log(`✅ Auto-completed appointment ${appointment.id}`);
          }
        } catch (error) {
          this.logger.error(
            `❌ Failed to update past appointment ${appointment.id}: ${error}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error in autoCompletePastAppointments: ${error}`);
    }
  }
}
