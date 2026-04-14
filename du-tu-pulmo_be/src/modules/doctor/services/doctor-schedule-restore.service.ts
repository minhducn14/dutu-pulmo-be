import { Injectable } from '@nestjs/common';
import { Between, EntityManager } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import {
  ScheduleType,
  SCHEDULE_TYPE_PRIORITY,
} from '@/modules/common/enums/schedule-type.enum';
import { endOfDayVN, getDayVN, startOfDayVN } from '@/common/datetime';

@Injectable()
export class DoctorScheduleRestoreService {
  async restoreSlots(
    manager: EntityManager,
    doctorId: string,
    specificDate: Date,
    rangeStart: Date,
    rangeEnd: Date,
    options?: {
      excludeTimeOffScheduleIds?: string[];
    },
  ): Promise<number> {
    const dayStart = startOfDayVN(specificDate);
    const dayEnd = endOfDayVN(specificDate);
    const timeOffSchedulesRaw = await manager.find(DoctorSchedule, {
      where: {
        doctorId,
        scheduleType: ScheduleType.TIME_OFF,
        specificDate: Between(dayStart, dayEnd),
      },
    });
    const excludedIds = new Set(options?.excludeTimeOffScheduleIds ?? []);
    const timeOffSchedules = timeOffSchedulesRaw.filter(
      (schedule) => !excludedIds.has(schedule.id),
    );
    const blockingPeriods = this.buildBlockingPeriods(
      timeOffSchedules,
      specificDate,
    );

    // Try to restore from the active FLEXIBLE winner for the day first.
    const flexibleSchedule = await manager.findOne(DoctorSchedule, {
      where: {
        doctorId,
        scheduleType: ScheduleType.FLEXIBLE,
        specificDate: Between(dayStart, dayEnd),
        isAvailable: true,
      },
    });

    if (flexibleSchedule) {
      return this.restoreFromSchedules(
        manager,
        doctorId,
        specificDate,
        rangeStart,
        rangeEnd,
        [flexibleSchedule],
        blockingPeriods,
      );
    }

    // Fallback to REGULAR when there is no active FLEXIBLE override.
    const dayOfWeek = getDayVN(specificDate);
    const regularSchedules = await manager.find(DoctorSchedule, {
      where: {
        doctorId,
        dayOfWeek,
        scheduleType: ScheduleType.REGULAR,
        isAvailable: true,
      },
    });

    const activeSchedules = regularSchedules.filter((schedule) => {
      if (schedule.effectiveFrom) {
        const from = startOfDayVN(new Date(schedule.effectiveFrom));
        if (specificDate < from) return false;
      }
      if (schedule.effectiveUntil) {
        const until = endOfDayVN(new Date(schedule.effectiveUntil));
        if (specificDate > until) return false;
      }
      return true;
    });

    if (activeSchedules.length === 0) return 0;

    const maxPriority = Math.max(
      ...activeSchedules.map((s) => SCHEDULE_TYPE_PRIORITY[s.scheduleType]),
    );
    const highestPrioritySchedules = activeSchedules.filter(
      (s) => SCHEDULE_TYPE_PRIORITY[s.scheduleType] === maxPriority,
    );

    return this.restoreFromSchedules(
      manager,
      doctorId,
      specificDate,
      rangeStart,
      rangeEnd,
      highestPrioritySchedules,
      blockingPeriods,
    );
  }

  private async restoreFromSchedules(
    manager: EntityManager,
    doctorId: string,
    specificDate: Date,
    rangeStart: Date,
    rangeEnd: Date,
    schedules: DoctorSchedule[],
    blockingPeriods: Array<{ start: Date; end: Date }>,
  ): Promise<number> {
    let totalRestoredSlots = 0;

    for (const schedule of schedules) {
      const [startH, startM] = schedule.startTime.split(':').map(Number);
      const [endH, endM] = schedule.endTime.split(':').map(Number);

      const baseDate = startOfDayVN(specificDate);

      const scheduleStart = new Date(
        baseDate.getTime() + (startH * 60 + startM) * 60000,
      );
      const scheduleEnd = new Date(
        baseDate.getTime() + (endH * 60 + endM) * 60000,
      );

      const overlapStart = new Date(
        Math.max(scheduleStart.getTime(), rangeStart.getTime()),
      );
      const overlapEnd = new Date(
        Math.min(scheduleEnd.getTime(), rangeEnd.getTime()),
      );

      if (overlapStart >= overlapEnd) {
        continue;
      }

      const existingSlots = await manager.find(TimeSlot, {
        where: {
          doctorId,
          startTime: Between(overlapStart, new Date(overlapEnd.getTime() - 1)),
        },
      });

      const slotDurationMs = schedule.slotDuration * 60 * 1000;
      let currentStart = new Date(overlapStart);
      const newSlots: TimeSlot[] = [];

      while (currentStart < overlapEnd) {
        const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
        if (slotEnd > overlapEnd) break;

        if (
          this.overlapsBlockingPeriod(currentStart, slotEnd, blockingPeriods)
        ) {
          currentStart = slotEnd;
          continue;
        }

        const matchingSlot = existingSlots.find(
          (s) =>
            Math.abs(s.startTime.getTime() - currentStart.getTime()) < 1000,
        );

        if (matchingSlot) {
          if (!matchingSlot.isAvailable && matchingSlot.bookedCount === 0) {
            matchingSlot.isAvailable = true;
            matchingSlot.capacity = schedule.slotCapacity;
            matchingSlot.scheduleId = schedule.id;
            await manager.save(matchingSlot);
            totalRestoredSlots++;
          }
        } else {
          const slot = manager.create(TimeSlot, {
            doctorId,
            scheduleId: schedule.id,
            scheduleVersion: schedule.version,
            startTime: new Date(currentStart),
            endTime: new Date(slotEnd),
            capacity: schedule.slotCapacity,
            allowedAppointmentTypes: [schedule.appointmentType],
            isAvailable: true,
            bookedCount: 0,
          });
          newSlots.push(slot);
        }

        currentStart = slotEnd;
      }

      if (newSlots.length > 0) {
        await manager.save(TimeSlot, newSlots);
        totalRestoredSlots += newSlots.length;
      }
    }

    return totalRestoredSlots;
  }

  private buildBlockingPeriods(
    schedules: DoctorSchedule[],
    specificDate: Date,
  ): Array<{ start: Date; end: Date }> {
    const baseDate = startOfDayVN(specificDate);
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
