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
import { MedicalService } from '@/modules/medical/medical.service';

@Injectable()
export class AppointmentSchedulerService {
  private readonly logger = new Logger(AppointmentSchedulerService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly dailyService: DailyService,
    private readonly dataSource: DataSource,
    private readonly medicalService: MedicalService,
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
            await this.dataSource.transaction(async (manager) => {
              await manager.update(Appointment, appointment.id, {
                status: AppointmentStatusEnum.CANCELLED,
                cancelledAt: new Date(),
                cancelledBy: 'SYSTEM',
                cancellationReason:
                  'Auto-cancelled by scheduler (past appointment)',
              });

              // Giải phóng slot (đảm bảo bookedCount chính xác cho thống kê)
              if (appointment.timeSlotId) {
                await manager.decrement(
                  TimeSlot,
                  { id: appointment.timeSlotId },
                  'bookedCount',
                  1,
                );

                // Mở lại slot nếu còn chỗ
                // (Thực tế slot đã qua ngày nên isAvailable không ảnh hưởng booking
                //  nhưng đảm bảo data consistency)
                const slot = await manager.findOne(TimeSlot, {
                  where: { id: appointment.timeSlotId },
                });
                if (slot && slot.bookedCount < slot.capacity) {
                  await manager.update(
                    TimeSlot,
                    { id: slot.id },
                    { isAvailable: true },
                  );
                }
              }
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
            const recordId = await this.dataSource.transaction(
              async (manager) => {
                // 1. Update Appointment Status
                await manager.update(Appointment, appointment.id, {
                  status: AppointmentStatusEnum.COMPLETED,
                  endedAt: appointment.endedAt || new Date(),
                });

                // 2. Find and Update Medical Record Status if exists
                const record = await manager.findOne(MedicalRecord, {
                  where: { appointmentId: appointment.id },
                });

                if (record) {
                  record.status = MedicalRecordStatusEnum.COMPLETED;
                  await manager.save(record);
                }

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

                return record?.id;
              },
            );

            this.logger.log(`✅ Auto-completed appointment ${appointment.id}`);

            // 4. Trigger PDF generation if record exists
            if (recordId) {
              void this.medicalService
                .generatePdfsForRecordWithRetry(recordId)
                .catch((err) => {
                  this.logger.error(
                    `Failed to generate PDFs for auto-completed record ${recordId}: ${err.message}`,
                  );
                });
            }
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
