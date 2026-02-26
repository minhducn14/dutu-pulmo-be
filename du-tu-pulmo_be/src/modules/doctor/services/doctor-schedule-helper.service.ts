import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { CreateDoctorScheduleDto } from '@/modules/doctor/dto/create-doctor-schedule.dto';
import { UpdateDoctorScheduleDto } from '@/modules/doctor/dto/update-doctor-schedule.dto';
import { SCHEDULE_TYPE_PRIORITY } from '@/modules/common/enums/schedule-type.enum';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

@Injectable()
export class DoctorScheduleHelperService {
  private readonly logger = new Logger(DoctorScheduleHelperService.name);
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
  ) {}

  validateTimeRange(
    dto: CreateDoctorScheduleDto | UpdateDoctorScheduleDto,
  ): void {
    if (dto.slotDuration !== undefined) {
      if (dto.slotDuration <= 0) {
        this.logger.error('Invalid slot duration. Slot duration must be greater than 0');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
      if (dto.slotDuration < 5) {
        this.logger.error('Invalid slot duration. Slot duration must be at least 5 minutes');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
      if (dto.slotDuration > 480) {
        this.logger.error('Invalid slot duration. Slot duration must be at most 480 minutes');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    if (dto.startTime && dto.endTime) {
      if (dto.startTime >= dto.endTime) {
        this.logger.error('Invalid start time or end time. Start time must be less than end time');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      if (dto.slotDuration) {
        const [startH, startM] = dto.startTime.split(':').map(Number);
        const [endH, endM] = dto.endTime.split(':').map(Number);
        const workingMinutes = endH * 60 + endM - (startH * 60 + startM);

        if (workingMinutes < dto.slotDuration) {
          this.logger.error('Invalid start time or end time. Working minutes must be greater than or equal to slot duration');
          throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }
      }
    }

    if (dto.effectiveFrom && dto.effectiveUntil) {
      const from = new Date(dto.effectiveFrom);
      const until = new Date(dto.effectiveUntil);

      if (from >= until) {
        this.logger.error('Invalid effective date. Effective from must be less than effective until');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }
  }

  validateBookingDaysConstraints(
    minimumBookingDays: number,
    maxAdvanceBookingDays: number,
  ): void {
    if (minimumBookingDays < 0 || maxAdvanceBookingDays < 0) {
      this.logger.error('Invalid booking days constraints. Minimum booking days and maximum advance booking days must be greater than or equal to 0');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (minimumBookingDays >= maxAdvanceBookingDays) {
      this.logger.error('Invalid booking days constraints. Minimum booking days must be less than maximum advance booking days');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }
  }

  async checkOverlap(
    doctorId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    effectiveFrom: Date | null,
    effectiveUntil: Date | null,
    priority: number,
    excludeId?: string,
  ): Promise<void> {
    // 1. Identify the Schedule Type based on priority/input context
    const isRegular = priority === SCHEDULE_TYPE_PRIORITY.REGULAR;
    const isFlexibleOrTimeOff = priority > SCHEDULE_TYPE_PRIORITY.REGULAR;

    // 2. Build Query
    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('s')
      .where('s.doctorId = :doctorId', { doctorId })
      .andWhere('s.priority = :priority', { priority });

    if (excludeId) {
      queryBuilder.andWhere('s.id != :excludeId', { excludeId });
    }

    const candidates = await queryBuilder.getMany();

    // 3. Strict Overlap Check in Memory
    for (const existing of candidates) {
      // 3.1 Logic for REGULAR (Priority 1)
      if (isRegular) {
        // Check Weekday
        if (existing.dayOfWeek !== dayOfWeek) continue;

        // Check Time Overlap: [start, end)
        const exStart = existing.startTime.slice(0, 5);
        const exEnd = existing.endTime.slice(0, 5);
        const newStart = startTime.slice(0, 5);
        const newEnd = endTime.slice(0, 5);

        if (exStart >= newEnd || exEnd <= newStart) {
          continue;
        }

        // Time Overlaps -> Check Date Range Overlap
        const newFrom = effectiveFrom ? new Date(effectiveFrom) : null;
        const newUntil = effectiveUntil ? new Date(effectiveUntil) : null;
        const exFrom = existing.effectiveFrom
          ? new Date(existing.effectiveFrom)
          : null;
        const exUntil = existing.effectiveUntil
          ? new Date(existing.effectiveUntil)
          : null;

        const isDateOverlap =
          (newFrom === null || exUntil === null || newFrom <= exUntil) &&
          (newUntil === null || exFrom === null || newUntil >= exFrom);

        if (isDateOverlap) {
          this.throwConflict(existing, 'REGULAR vs REGULAR');
        }
      }

      // 3.2 Logic for FLEXIBLE / TIME_OFF (Priority > 1)
      if (isFlexibleOrTimeOff) {
        // Check Specific Date Match
        const newSpecific = effectiveFrom;
        const exSpecific = existing.specificDate;

        if (newSpecific && exSpecific) {
          const d1 = new Date(newSpecific).toISOString().split('T')[0];
          const d2 = new Date(exSpecific).toISOString().split('T')[0];

          if (d1 === d2) {
            // Same Date -> Check Time Overlap [start, end)
            // Allow Split Shifts: Multiple non-overlapping records for the same day are valid.
            if (
              existing.startTime >= endTime ||
              existing.endTime <= startTime
            ) {
              continue;
            }

            // Same Date AND Time Overlap -> Conflict
            this.throwConflict(existing, 'FLEXIBLE/TIMEOFF vs SAME PRIORITY');
          }
        }
      }
    }
  }

  private throwConflict(overlapping: DoctorSchedule, reason: string): void {
    const status = overlapping.isAvailable
      ? 'đang hoạt động'
      : 'không hoạt động';
    const effectiveStr = `(Hiệu lực: ${
      overlapping.effectiveFrom
        ? new Date(overlapping.effectiveFrom).toISOString().split('T')[0]
        : '...'
    } -> ${
      overlapping.effectiveUntil
        ? new Date(overlapping.effectiveUntil).toISOString().split('T')[0]
        : '...'
    })`;
    throw new ConflictException(
      `Xung đột lịch (${reason}): Lịch trùng với lịch ${status} (priority: ${overlapping.priority}) ${effectiveStr} ` +
        `khung giờ (${overlapping.startTime} - ${overlapping.endTime}).`,
    );
  }

  async hasShadowingSchedule(
    doctorId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    effectiveFrom: Date | null,
    effectiveUntil: Date | null,
    priority: number,
  ): Promise<boolean> {
    if (priority !== SCHEDULE_TYPE_PRIORITY.REGULAR) return false;

    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('s')
      .where('s.doctorId = :doctorId', { doctorId })
      .andWhere('s.priority > :priority', { priority })
      .andWhere('s.specificDate IS NOT NULL')
      .andWhere('s.startTime < :endTime', { endTime })
      .andWhere('s.endTime > :startTime', { startTime });

    if (effectiveFrom) {
      queryBuilder.andWhere('s.specificDate >= :effectiveFrom', {
        effectiveFrom,
      });
    }
    if (effectiveUntil) {
      queryBuilder.andWhere('s.specificDate <= :effectiveUntil', {
        effectiveUntil,
      });
    }

    queryBuilder.andWhere('EXTRACT(DOW FROM s.specific_date) = :dayOfWeek', {
      dayOfWeek,
    });

    const count = await queryBuilder.getCount();
    return count > 0;
  }

  isScheduleActiveOnDate(schedule: DoctorSchedule, date: Date): boolean {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (schedule.effectiveFrom) {
      const effectiveFrom = new Date(schedule.effectiveFrom);
      effectiveFrom.setHours(0, 0, 0, 0);
      if (checkDate.getTime() < effectiveFrom.getTime()) return false;
    }

    if (schedule.effectiveUntil) {
      const effectiveUntil = new Date(schedule.effectiveUntil);
      effectiveUntil.setHours(23, 59, 59, 999);
      if (checkDate.getTime() > effectiveUntil.getTime()) return false;
    }

    return true;
  }
}
