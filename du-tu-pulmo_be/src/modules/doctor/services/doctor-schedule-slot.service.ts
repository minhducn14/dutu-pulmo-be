import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, MoreThan, Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import {
  ScheduleType,
  SCHEDULE_TYPE_PRIORITY,
} from '@/modules/common/enums/schedule-type.enum';
import { DoctorScheduleHelperService } from '@/modules/doctor/services/doctor-schedule-helper.service';

@Injectable()
export class DoctorScheduleSlotService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    private readonly dataSource: DataSource,
    private readonly helper: DoctorScheduleHelperService,
  ) {}

  async generateSlotsForSchedule(
    schedule: DoctorSchedule,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const regularPriority = SCHEDULE_TYPE_PRIORITY[ScheduleType.REGULAR];
    let totalGeneratedSlots = 0;

    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      if (currentDate.getDay() === schedule.dayOfWeek) {
        if (!this.helper.isScheduleActiveOnDate(schedule, currentDate)) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const higherPrioritySchedules = await this.scheduleRepository.find({
          where: {
            doctorId: schedule.doctorId,
            priority: MoreThan(regularPriority),
            specificDate: Between(dayStart, dayEnd),
          },
        });

        if (higherPrioritySchedules.length > 0) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);

        const scheduleStart = new Date(currentDate);
        scheduleStart.setHours(startH, startM, 0, 0);

        const scheduleEnd = new Date(currentDate);
        scheduleEnd.setHours(endH, endM, 0, 0);

        const existingSlots = await this.dataSource.manager.find(TimeSlot, {
          where: {
            doctorId: schedule.doctorId,
            startTime: Between(scheduleStart, scheduleEnd),
          },
        });

        const slotDurationMs = schedule.slotDuration * 60 * 1000;
        let slotStart = new Date(scheduleStart);
        const newSlots: TimeSlot[] = [];

        while (slotStart < scheduleEnd) {
          const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
          if (slotEnd > scheduleEnd) break;

          const hasOverlap = existingSlots.some(
            (s) => slotStart < s.endTime && slotEnd > s.startTime,
          );

          if (!hasOverlap) {
            const slot = this.dataSource.manager.create(TimeSlot, {
              doctorId: schedule.doctorId,
              scheduleId: schedule.id,
              scheduleVersion: schedule.version,
              startTime: new Date(slotStart),
              endTime: new Date(slotEnd),
              capacity: schedule.slotCapacity,
              allowedAppointmentTypes: [schedule.appointmentType],
              isAvailable: true,
              bookedCount: 0,
            });
            newSlots.push(slot);
          }

          slotStart = slotEnd;
        }

        if (newSlots.length > 0) {
          await this.dataSource.manager.save(TimeSlot, newSlots);
          totalGeneratedSlots += newSlots.length;
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalGeneratedSlots;
  }

  async disableOldSlots(): Promise<number> {
    const now = new Date();

    const result = await this.dataSource
      .createQueryBuilder()
      .update(TimeSlot)
      .set({ isAvailable: false })
      .where('startTime < :now', { now })
      .andWhere('isAvailable = true')
      .execute();

    return result.affected || 0;
  }

  async generateSlotsForNextDay(): Promise<{
    doctorsProcessed: number;
    slotsGenerated: number;
  }> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setHours(23, 59, 59, 999);

    const tomorrowDayOfWeek = tomorrow.getDay();

    const activeSchedules = await this.scheduleRepository
      .createQueryBuilder('s')
      .where('s.scheduleType = :type', { type: ScheduleType.REGULAR })
      .andWhere('s.dayOfWeek = :dow', { dow: tomorrowDayOfWeek })
      .andWhere('s.isAvailable = true')
      .andWhere('(s.effectiveFrom IS NULL OR s.effectiveFrom <= :date)', {
        date: tomorrow,
      })
      .andWhere('(s.effectiveUntil IS NULL OR s.effectiveUntil >= :date)', {
        date: tomorrow,
      })
      .getMany();

    let totalSlotsGenerated = 0;
    const doctorIds = new Set<string>();

    for (const schedule of activeSchedules) {
      doctorIds.add(schedule.doctorId);

      const slotsGenerated = await this.generateSlotsForSchedule(
        schedule,
        tomorrow,
        dayAfterTomorrow,
      );
      totalSlotsGenerated += slotsGenerated;
    }

    return {
      doctorsProcessed: doctorIds.size,
      slotsGenerated: totalSlotsGenerated,
    };
  }
}
