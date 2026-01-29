import { Injectable } from '@nestjs/common';
import { ResponseCommon } from '@/common/dto/response.dto';
import {
  CreateDoctorScheduleDto,
  UpdateDoctorScheduleDto,
} from '@/modules/doctor/dto/doctor-schedule.dto';
import {
  CreateFlexibleScheduleDto,
  UpdateFlexibleScheduleDto,
} from '@/modules/doctor/dto/flexible-schedule.dto';
import { CreateTimeOffDto, UpdateTimeOffDto } from '@/modules/doctor/dto/time-off.dto';
import {
  PreviewFlexibleScheduleConflictsDto,
  PreviewTimeOffConflictsDto,
  PreviewConflictsResponseDto,
} from '@/modules/doctor/dto/preview-conflicts.dto';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';
import { DoctorScheduleQueryService } from '@/modules/doctor/services/doctor-schedule-query.service';
import { DoctorScheduleRegularService } from '@/modules/doctor/services/doctor-schedule-regular.service';
import { DoctorScheduleFlexibleService } from '@/modules/doctor/services/doctor-schedule-flexible.service';
import { DoctorScheduleTimeOffService } from '@/modules/doctor/services/doctor-schedule-timeoff.service';
import { DoctorScheduleFeeService } from '@/modules/doctor/services/doctor-schedule-fee.service';
import { DoctorSchedulePreviewService } from '@/modules/doctor/services/doctor-schedule-preview.service';
import { DoctorScheduleSlotService } from '@/modules/doctor/services/doctor-schedule-slot.service';
import { UpdateManyRegularItem } from '@/modules/doctor/services/doctor-schedule-regular.service';

@Injectable()
export class DoctorScheduleService {
  constructor(
    private readonly queryService: DoctorScheduleQueryService,
    private readonly regularService: DoctorScheduleRegularService,
    private readonly flexibleService: DoctorScheduleFlexibleService,
    private readonly timeOffService: DoctorScheduleTimeOffService,
    private readonly feeService: DoctorScheduleFeeService,
    private readonly previewService: DoctorSchedulePreviewService,
    private readonly slotService: DoctorScheduleSlotService,
  ) {}

  findByDoctorId(doctorId: string): Promise<ResponseCommon<DoctorSchedule[]>> {
    return this.queryService.findByDoctorId(doctorId);
  }

  findByDoctorIdAndType(
    doctorId: string,
    scheduleType: ScheduleType,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    return this.queryService.findByDoctorIdAndType(doctorId, scheduleType);
  }

  findById(id: string): Promise<ResponseCommon<DoctorSchedule>> {
    return this.queryService.findById(id);
  }

  findByIdWithTimeSlots(id: string): Promise<ResponseCommon<DoctorSchedule>> {
    return this.queryService.findByIdWithTimeSlots(id);
  }

  validateDoctorOwnership(
    scheduleId: string,
    doctorId: string,
  ): Promise<DoctorSchedule> {
    return this.queryService.validateDoctorOwnership(scheduleId, doctorId);
  }

  getAppointmentsByScheduleVersion(
    scheduleId: string,
    version: number,
  ): Promise<Appointment[]> {
    return this.queryService.getAppointmentsByScheduleVersion(
      scheduleId,
      version,
    );
  }

  getScheduleVersionHistory(scheduleId: string): Promise<
    {
      version: number;
      appointmentCount: number;
      activeCount: number;
      cancelledCount: number;
    }[]
  > {
    return this.queryService.getScheduleVersionHistory(scheduleId);
  }

  createRegular(
    doctorId: string,
    dto: CreateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    return this.regularService.createRegular(doctorId, dto);
  }

  createManyRegular(
    doctorId: string,
    dtos: CreateDoctorScheduleDto[],
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    return this.regularService.createManyRegular(doctorId, dtos);
  }

  updateManyRegular(
    doctorId: string,
    items: UpdateManyRegularItem[],
  ): Promise<
    ResponseCommon<{
      updatedSchedules: DoctorSchedule[];
      totalGeneratedSlots: number;
      totalWarningAppointments: number;
      failedUpdates: { id: string; reason: string }[];
    }>
  > {
    return this.regularService.updateManyRegular(doctorId, items);
  }

  updateRegular(
    id: string,
    dto: UpdateDoctorScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    return this.regularService.updateRegular(id, dto);
  }

  deleteRegular(id: string): Promise<
    ResponseCommon<{
      cancelledAppointments: number;
      deletedSlots: number;
    }>
  > {
    return this.regularService.deleteRegular(id);
  }

  findAvailableByDoctor(
    doctorId: string,
    dayOfWeek?: number,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    return this.queryService.findAvailableByDoctor(doctorId, dayOfWeek);
  }

  getEffectiveConsultationFee(
    scheduleId: string,
  ): Promise<ResponseCommon<{ scheduleId: string; fee: string | null }>> {
    return this.resolveEffectiveFee(scheduleId);
  }

  getConsultationFeeDetails(schedule: DoctorSchedule): Promise<{
    baseFee: string | null;
    discountPercent: number;
    finalFee: string | null;
  }> {
    return this.feeService.getConsultationFeeDetails(schedule);
  }

  enrichScheduleWithEffectiveFee(schedule: DoctorSchedule): Promise<
    DoctorSchedule & {
      effectiveConsultationFee: string | null;
      finalFee: string | null;
      savedAmount: string | null;
      minimumBookingDays: number;
    }
  > {
    return this.feeService.enrichScheduleWithEffectiveFee(schedule);
  }

  enrichSchedulesWithEffectiveFee(schedules: DoctorSchedule[]): Promise<
    (DoctorSchedule & {
      effectiveConsultationFee: string | null;
      finalFee: string | null;
      savedAmount: string | null;
      minimumBookingDays: number;
    })[]
  > {
    return this.feeService.enrichSchedulesWithEffectiveFee(schedules);
  }

  createFlexibleSchedule(
    doctorId: string,
    dto: CreateFlexibleScheduleDto,
  ): Promise<
    ResponseCommon<
      DoctorSchedule & {
        cancelledAppointments: number;
        generatedSlots: number;
      }
    >
  > {
    return this.flexibleService.createFlexibleSchedule(doctorId, dto);
  }

  updateFlexibleSchedule(
    id: string,
    dto: UpdateFlexibleScheduleDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    return this.flexibleService.updateFlexibleSchedule(id, dto);
  }

  deleteFlexibleSchedule(id: string): Promise<
    ResponseCommon<{
      cancelledAppointments: number;
      deletedSlots: number;
      restoredSlots: number;
    }>
  > {
    return this.flexibleService.deleteFlexibleSchedule(id);
  }

  createTimeOff(
    doctorId: string,
    dto: CreateTimeOffDto,
  ): Promise<
    ResponseCommon<
      DoctorSchedule & {
        cancelledAppointments: number;
        disabledSlots: number;
      }
    >
  > {
    return this.timeOffService.createTimeOff(doctorId, dto);
  }

  updateTimeOff(
    id: string,
    dto: UpdateTimeOffDto,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    return this.timeOffService.updateTimeOff(id, dto);
  }

  deleteTimeOff(id: string): Promise<
    ResponseCommon<{
      restoredSlots: number;
    }>
  > {
    return this.timeOffService.deleteTimeOff(id);
  }

  previewFlexibleScheduleConflicts(
    doctorId: string,
    dto: PreviewFlexibleScheduleConflictsDto,
  ): Promise<ResponseCommon<PreviewConflictsResponseDto>> {
    return this.previewService.previewFlexibleScheduleConflicts(doctorId, dto);
  }

  previewTimeOffConflicts(
    doctorId: string,
    dto: PreviewTimeOffConflictsDto,
  ): Promise<ResponseCommon<PreviewConflictsResponseDto>> {
    return this.previewService.previewTimeOffConflicts(doctorId, dto);
  }

  generateSlotsForSchedule(
    schedule: DoctorSchedule,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    return this.slotService.generateSlotsForSchedule(
      schedule,
      startDate,
      endDate,
    );
  }

  disableOldSlots(): Promise<number> {
    return this.slotService.disableOldSlots();
  }

  generateSlotsForNextDay(): Promise<{
    doctorsProcessed: number;
    slotsGenerated: number;
  }> {
    return this.slotService.generateSlotsForNextDay();
  }

  private async resolveEffectiveFee(
    scheduleId: string,
  ): Promise<ResponseCommon<{ scheduleId: string; fee: string | null }>> {
    const scheduleResult = await this.queryService.findById(scheduleId);
    const schedule = scheduleResult.data!;
    const fee = await this.feeService.getEffectiveConsultationFee(schedule);
    return new ResponseCommon(200, 'SUCCESS', { scheduleId, fee });
  }
}
