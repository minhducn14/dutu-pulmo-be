import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import {
  CreateDoctorScheduleDto,
  UpdateDoctorScheduleDto,
} from '@/modules/doctor/dto/doctor-schedule.dto';

@Injectable()
export class DoctorScheduleHelperService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
  ) {}

  validateTimeRange(
    dto: CreateDoctorScheduleDto | UpdateDoctorScheduleDto,
  ): void {
    if (dto.slotDuration !== undefined) {
      if (dto.slotDuration <= 0) {
        throw new BadRequestException('Thời lượng slot phải lớn hơn 0 phút');
      }
      if (dto.slotDuration < 5) {
        throw new BadRequestException('Thời lượng slot tối thiểu 5 phút');
      }
      if (dto.slotDuration > 480) {
        throw new BadRequestException(
          'Thời lượng slot tối đa 480 phút (8 giờ)',
        );
      }
    }

    if (dto.startTime && dto.endTime) {
      if (dto.startTime >= dto.endTime) {
        throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
      }

      if (dto.slotDuration) {
        const [startH, startM] = dto.startTime.split(':').map(Number);
        const [endH, endM] = dto.endTime.split(':').map(Number);
        const workingMinutes = endH * 60 + endM - (startH * 60 + startM);

        if (workingMinutes < dto.slotDuration) {
          throw new BadRequestException(
            `Khoảng thời gian làm việc (${workingMinutes} phút) không đủ cho 1 slot (${dto.slotDuration} phút)`,
          );
        }
      }
    }

    if (dto.effectiveFrom && dto.effectiveUntil) {
      const from = new Date(dto.effectiveFrom);
      const until = new Date(dto.effectiveUntil);

      if (from >= until) {
        throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
      }
    }
  }

  validateBookingDaysConstraints(
    minimumBookingDays: number,
    maxAdvanceBookingDays: number,
  ): void {
    if (minimumBookingDays < 0 || maxAdvanceBookingDays < 0) {
      throw new BadRequestException(
        'Số ngày phải đặt trước và số ngày xa nhất phải lớn hơn hoặc bằng 0',
      );
    }

    if (minimumBookingDays >= maxAdvanceBookingDays) {
      throw new BadRequestException(
        `Cấu hình không hợp lệ: Số ngày phải đặt trước (${minimumBookingDays} ngày) ` +
          `không thể lớn hơn hoặc bằng số ngày xa nhất (${maxAdvanceBookingDays} ngày). ` +
          'Không có khoảng thời gian nào hợp lệ để đặt lịch.',
      );
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
    const isRegular = priority === 1;
    const isFlexibleOrTimeOff = priority > 1;

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
        // If times do NOT overlap, it's fine (e.g. 08:00-12:00 and 13:00-17:00 both Regular on Monday)
        if (existing.startTime >= endTime || existing.endTime <= startTime) {
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
             // Allow Split Shifts: If times do NOT overlap, it is valid.
             if (existing.startTime >= endTime || existing.endTime <= startTime) {
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
    if (priority !== 1) return false;

    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('s')
      .where('s.doctorId = :doctorId', { doctorId })
      .andWhere('s.priority > :priority', { priority })
      .andWhere('s.specificDate IS NOT NULL')
      .andWhere('s.startTime < :endTime', { endTime })
      .andWhere('s.endTime > :startTime', { startTime });

    if (effectiveFrom) {
      queryBuilder.andWhere('s.specificDate >= :effectiveFrom', { effectiveFrom });
    }
    if (effectiveUntil) {
      queryBuilder.andWhere('s.specificDate <= :effectiveUntil', { effectiveUntil });
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
