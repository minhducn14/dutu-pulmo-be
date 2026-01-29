import { Injectable } from '@nestjs/common';
import { Between, EntityManager } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import {
  ScheduleType,
  SCHEDULE_TYPE_PRIORITY,
} from '@/modules/common/enums/schedule-type.enum';

@Injectable()
export class DoctorScheduleRestoreService {
  async restoreSlotsFromRegularSchedules(
    manager: EntityManager,
    doctorId: string,
    dayOfWeek: number,
    specificDate: Date,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<number> {
    const regularSchedules = await manager.find(DoctorSchedule, {
      where: {
        doctorId,
        dayOfWeek,
        scheduleType: ScheduleType.REGULAR,
        isAvailable: true,
      },
      relations: ['doctor'],
    });

    const activeSchedules = regularSchedules.filter((schedule) => {
      if (schedule.effectiveFrom) {
        const from = new Date(schedule.effectiveFrom);
        from.setHours(0, 0, 0, 0);
        if (specificDate < from) return false;
      }
      if (schedule.effectiveUntil) {
        const until = new Date(schedule.effectiveUntil);
        until.setHours(23, 59, 59, 999);
        if (specificDate > until) return false;
      }
      return true;
    });

    // Fix 3: Only restore from highest priority schedules
    if (activeSchedules.length === 0) return 0;

    const maxPriority = Math.max(
      ...activeSchedules.map((s) => SCHEDULE_TYPE_PRIORITY[s.scheduleType]),
    );
    const highestPrioritySchedules = activeSchedules.filter(
      (s) => SCHEDULE_TYPE_PRIORITY[s.scheduleType] === maxPriority,
    );

    let totalRestoredSlots = 0;

    for (const regularSchedule of highestPrioritySchedules) {
      const [regStartH, regStartM] = regularSchedule.startTime
        .split(':')
        .map(Number);
      const [regEndH, regEndM] = regularSchedule.endTime.split(':').map(Number);

      const regScheduleStart = new Date(specificDate);
      regScheduleStart.setHours(regStartH, regStartM, 0, 0);

      const regScheduleEnd = new Date(specificDate);
      regScheduleEnd.setHours(regEndH, regEndM, 0, 0);

      const overlapStart = new Date(
        Math.max(regScheduleStart.getTime(), rangeStart.getTime()),
      );
      const overlapEnd = new Date(
        Math.min(regScheduleEnd.getTime(), rangeEnd.getTime()),
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

      const slotDurationMs = regularSchedule.slotDuration * 60 * 1000;
      let currentStart = new Date(overlapStart);
      const newSlots: TimeSlot[] = [];

      while (currentStart < overlapEnd) {
        const slotEnd = new Date(currentStart.getTime() + slotDurationMs);
        if (slotEnd > overlapEnd) break;

        const matchingSlot = existingSlots.find(
          (s) =>
            Math.abs(s.startTime.getTime() - currentStart.getTime()) < 1000,
        );

        if (matchingSlot) {
          if (!matchingSlot.isAvailable && matchingSlot.bookedCount === 0) {
            matchingSlot.isAvailable = true;
            matchingSlot.capacity = regularSchedule.slotCapacity;
            matchingSlot.scheduleId = regularSchedule.id;
            await manager.save(matchingSlot);
            totalRestoredSlots++;
          }
        } else {
          const slot = manager.create(TimeSlot, {
            doctorId,
            scheduleId: regularSchedule.id,
            scheduleVersion: regularSchedule.version,
            startTime: new Date(currentStart),
            endTime: new Date(slotEnd),
            capacity: regularSchedule.slotCapacity,
            allowedAppointmentTypes: [regularSchedule.appointmentType],
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
}
