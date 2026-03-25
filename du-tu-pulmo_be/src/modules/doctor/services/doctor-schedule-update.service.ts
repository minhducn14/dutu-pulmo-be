import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { ResponseCommon } from '@/common/dto/response.dto';
import { UpdateDoctorScheduleDto } from '@/modules/doctor/dto/update-doctor-schedule.dto';
import { DoctorScheduleHelperService } from '@/modules/doctor/services/doctor-schedule-helper.service';
import { DoctorScheduleQueryService } from '@/modules/doctor/services/doctor-schedule-query.service';

@Injectable()
export class DoctorScheduleUpdateService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    private readonly helper: DoctorScheduleHelperService,
    private readonly queryService: DoctorScheduleQueryService,
  ) {}

  async updateScheduleInternal(
    id: string,
    dto: UpdateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const existingResult = await this.queryService.findById(id);
    const existing = existingResult.data!;

    this.helper.validateTimeRange(dto);

    const newDayOfWeek = dto.dayOfWeek ?? existing.dayOfWeek;
    const newStartTime = dto.startTime ?? existing.startTime;
    const newEndTime = dto.endTime ?? existing.endTime;

    const priority = existing.priority;
    const newIsAvailable = dto.isAvailable ?? existing.isAvailable;

    let newEffectiveFrom: Date | null = existing.effectiveFrom;
    if (dto.effectiveFrom !== undefined) {
      newEffectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    }

    let newEffectiveUntil: Date | null = existing.effectiveUntil;
    if (dto.effectiveUntil !== undefined) {
      newEffectiveUntil = dto.effectiveUntil
        ? new Date(dto.effectiveUntil)
        : null;
    }

    const existingMinimumBookingDays = Math.floor(
      (existing.minimumBookingTime ?? 0) / (24 * 60),
    );
    const newMinimumBookingDays =
      dto.minimumBookingDays ?? existingMinimumBookingDays;
    const newMaxAdvanceBookingDays =
      dto.maxAdvanceBookingDays ?? existing.maxAdvanceBookingDays;

    this.helper.validateBookingDaysConstraints(
      newMinimumBookingDays,
      newMaxAdvanceBookingDays,
    );

    if (
      dto.dayOfWeek !== undefined ||
      dto.startTime !== undefined ||
      dto.endTime !== undefined ||
      dto.effectiveFrom !== undefined ||
      dto.effectiveUntil !== undefined
    ) {
      await this.helper.checkOverlap(
        existing.doctorId,
        newDayOfWeek,
        newStartTime,
        newEndTime,
        newEffectiveFrom,
        newEffectiveUntil,
        priority,
        id,
      );
    }

    const updateData: Partial<DoctorSchedule> = {
      isAvailable: newIsAvailable,
      note: dto.note !== undefined ? dto.note : existing.note,
      dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
      startTime: dto.startTime ?? existing.startTime,
      endTime: dto.endTime ?? existing.endTime,
      slotDuration: dto.slotDuration ?? existing.slotDuration,
      slotCapacity: dto.slotCapacity ?? existing.slotCapacity,
      appointmentType: dto.appointmentType ?? existing.appointmentType,
      maxAdvanceBookingDays:
        dto.maxAdvanceBookingDays ?? existing.maxAdvanceBookingDays,
      discountPercent: dto.discountPercent ?? existing.discountPercent,
      description:
        dto.description !== undefined ? dto.description : existing.description,
      minimumBookingTime:
        dto.minimumBookingDays !== undefined
          ? dto.minimumBookingDays * 24 * 60
          : existing.minimumBookingTime,
      consultationFee:
        dto.consultationFee !== undefined
          ? (dto.consultationFee?.toString() ?? null)
          : existing.consultationFee,
      effectiveFrom:
        dto.effectiveFrom !== undefined
          ? dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : null
          : existing.effectiveFrom,
      effectiveUntil:
        dto.effectiveUntil !== undefined
          ? dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null
          : existing.effectiveUntil,
    };

    // Xóa các trường không nên update trực tiếp hoặc đã handle ở trên
    const dataToUpdate = updateData as Record<string, unknown>;
    delete dataToUpdate.id;

    // Xóa undefined để không ghi đè bằng null không cần thiết
    (Object.keys(updateData) as (keyof typeof updateData)[]).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await this.scheduleRepository.update(id, updateData);
    const updatedResult = await this.queryService.findById(id);
    return new ResponseCommon(
      200,
      'Cập nhật lịch thành công',
      updatedResult.data,
    );
  }
}
