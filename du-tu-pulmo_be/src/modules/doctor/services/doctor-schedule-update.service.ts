import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { ResponseCommon } from '@/common/dto/response.dto';
import { UpdateDoctorScheduleDto } from '@/modules/doctor/dto/doctor-schedule.dto';
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
      ...dto,
      scheduleType: undefined,
      priority: undefined,
      isAvailable: newIsAvailable,
      consultationFee:
        dto.consultationFee !== undefined
          ? (dto.consultationFee?.toString() ?? null)
          : undefined,
      effectiveFrom:
        dto.effectiveFrom !== undefined
          ? dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : null
          : undefined,
      effectiveUntil:
        dto.effectiveUntil !== undefined
          ? dto.effectiveUntil
            ? new Date(dto.effectiveUntil)
            : null
          : undefined,
    };

    Object.keys(updateData).forEach((key) => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
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
