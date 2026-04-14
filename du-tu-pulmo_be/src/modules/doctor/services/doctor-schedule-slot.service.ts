import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';
import { DoctorScheduleHelperService } from '@/modules/doctor/services/doctor-schedule-helper.service';
import {
  vnNow,
  startOfDayVN,
  endOfDayVN,
  addDaysVN,
  getDayVN,
  startOfNextMonthVN,
  endOfNextMonthVN,
} from '@/common/datetime';

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
    manager?: EntityManager,
  ): Promise<number> {
    if (!schedule.isAvailable) {
      return 0;
    }

    let totalGeneratedSlots = 0;
    const currentManager = manager ?? this.dataSource.manager;
    const scheduleRepo = currentManager.getRepository(DoctorSchedule);

    const currentDate = startOfDayVN(startDate);

    while (currentDate <= endDate) {
      if (getDayVN(currentDate) !== schedule.dayOfWeek) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      if (!this.helper.isScheduleActiveOnDate(schedule, currentDate)) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const dayStart = startOfDayVN(currentDate);
      const dayEnd = endOfDayVN(currentDate);

      const flexibleSchedules = await scheduleRepo.find({
        where: {
          doctorId: schedule.doctorId,
          scheduleType: ScheduleType.FLEXIBLE,
          specificDate: Between(dayStart, dayEnd),
          isAvailable: true,
        },
      });

      if (flexibleSchedules.length > 0) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      const timeOffSchedules = await scheduleRepo.find({
        where: {
          doctorId: schedule.doctorId,
          scheduleType: ScheduleType.TIME_OFF,
          specificDate: Between(dayStart, dayEnd),
        },
      });
      const blockingPeriods = this.buildBlockingPeriods(
        timeOffSchedules,
        currentDate,
      );

      const [startH, startM] = schedule.startTime.split(':').map(Number);
      const [endH, endM] = schedule.endTime.split(':').map(Number);

      const scheduleStart = new Date(
        dayStart.getTime() + (startH * 60 + startM) * 60000,
      );
      const scheduleEnd = new Date(
        dayStart.getTime() + (endH * 60 + endM) * 60000,
      );

      const existingSlots = await currentManager
        .createQueryBuilder(TimeSlot, 'slot')
        .where('slot.doctorId = :doctorId', {
          doctorId: schedule.doctorId,
        })
        .andWhere('slot.startTime < :scheduleEnd', { scheduleEnd })
        .andWhere('slot.endTime > :scheduleStart', { scheduleStart })
        .getMany();

      const slotDurationMs = schedule.slotDuration * 60 * 1000;
      let slotStart = new Date(scheduleStart);
      const newSlots: TimeSlot[] = [];

      while (slotStart < scheduleEnd) {
        const slotEnd = new Date(slotStart.getTime() + slotDurationMs);
        if (slotEnd > scheduleEnd) break;

        if (this.overlapsBlockingPeriod(slotStart, slotEnd, blockingPeriods)) {
          slotStart = slotEnd;
          continue;
        }

        const hasOverlap = existingSlots.some(
          (existingSlot) =>
            slotStart < existingSlot.endTime &&
            slotEnd > existingSlot.startTime,
        );

        if (!hasOverlap) {
          newSlots.push(
            currentManager.create(TimeSlot, {
              doctorId: schedule.doctorId,
              scheduleId: schedule.id,
              scheduleVersion: schedule.version,
              startTime: new Date(slotStart),
              endTime: new Date(slotEnd),
              capacity: schedule.slotCapacity,
              allowedAppointmentTypes: [schedule.appointmentType],
              isAvailable: true,
              bookedCount: 0,
            }),
          );
        }

        slotStart = slotEnd;
      }

      if (newSlots.length > 0) {
        await currentManager.save(TimeSlot, newSlots);
        totalGeneratedSlots += newSlots.length;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return totalGeneratedSlots;
  }

  async disableOldSlots(): Promise<number> {
    const now = vnNow();

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
    const now = vnNow();
    const tomorrow = addDaysVN(startOfDayVN(now), 1);
    const dayAfterTomorrow = endOfDayVN(tomorrow);

    const tomorrowDayOfWeek = getDayVN(tomorrow);

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

  async generateSlotsForNextMonth(): Promise<{
    doctorsProcessed: number;
    slotsGenerated: number;
  }> {
    const nextMonthStart = startOfNextMonthVN();
    const nextMonthEnd = endOfNextMonthVN();

    const activeSchedules = await this.scheduleRepository
      .createQueryBuilder('s')
      .where('s.scheduleType = :type', { type: ScheduleType.REGULAR })
      .andWhere('s.isAvailable = true')
      .andWhere('(s.effectiveFrom IS NULL OR s.effectiveFrom <= :end)', {
        end: nextMonthEnd,
      })
      .andWhere('(s.effectiveUntil IS NULL OR s.effectiveUntil >= :start)', {
        start: nextMonthStart,
      })
      .getMany();

    let totalSlotsGenerated = 0;
    const doctorIds = new Set<string>();

    for (const schedule of activeSchedules) {
      doctorIds.add(schedule.doctorId);

      const slotsGenerated = await this.generateSlotsForSchedule(
        schedule,
        nextMonthStart,
        nextMonthEnd,
      );
      totalSlotsGenerated += slotsGenerated;
    }

    return {
      doctorsProcessed: doctorIds.size,
      slotsGenerated: totalSlotsGenerated,
    };
  }

  private buildBlockingPeriods(
    schedules: DoctorSchedule[],
    targetDate: Date,
  ): Array<{ start: Date; end: Date }> {
    const baseDate = startOfDayVN(targetDate);
    const periods = schedules
      .map((schedule) => {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);

        return {
          start: new Date(baseDate.getTime() + (startH * 60 + startM) * 60000),
          end: new Date(baseDate.getTime() + (endH * 60 + endM) * 60000),
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged: Array<{ start: Date; end: Date }> = [];
    for (const period of periods) {
      const last = merged[merged.length - 1];
      if (!last || period.start > last.end) {
        merged.push(period);
        continue;
      }

      last.end = new Date(Math.max(last.end.getTime(), period.end.getTime()));
    }

    return merged;
  }

  private overlapsBlockingPeriod(
    slotStart: Date,
    slotEnd: Date,
    blockingPeriods: Array<{ start: Date; end: Date }>,
  ): boolean {
    return blockingPeriods.some(
      (period) => slotStart < period.end && slotEnd > period.start,
    );
  }
}
