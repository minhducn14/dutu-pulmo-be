import { Injectable } from '@nestjs/common';
import { ResponseCommon } from '@/common/dto/response.dto';
import {
  AppointmentResponseDto,
  AppointmentStatisticsDto,
  DoctorQueueDto,
  PaginatedAppointmentResponseDto,
} from '@/modules/appointment/dto/appointment-response.dto';
import {
  AppointmentQueryDto,
  PatientAppointmentQueryDto,
} from '@/modules/appointment/dto/appointment-query.dto';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentReadService } from '@/modules/appointment/services/appointment-read.service';
import { AppointmentStatsService } from '@/modules/appointment/services/appointment-stats.service';
import { AppointmentCalendarService } from '@/modules/appointment/services/appointment-calendar.service';
import { AppointmentEntityService } from '@/modules/appointment/services/appointment-entity.service';
import { AppointmentCheckinService } from '@/modules/appointment/services/appointment-checkin.service';
import { AppointmentCreateService } from '@/modules/appointment/services/appointment-create.service';
import { AppointmentSchedulingService } from '@/modules/appointment/services/appointment-scheduling.service';
import { AppointmentStatusService } from '@/modules/appointment/services/appointment-status.service';
import { AppointmentVideoService } from '@/modules/appointment/services/appointment-video.service';
import { CompleteExaminationDto } from '@/modules/appointment/dto/complete-examination.dto';

@Injectable()
export class AppointmentService {
  constructor(
    private readonly appointmentReadService: AppointmentReadService,
    private readonly appointmentStatsService: AppointmentStatsService,
    private readonly appointmentCalendarService: AppointmentCalendarService,
    private readonly appointmentEntityService: AppointmentEntityService,
    private readonly appointmentCheckinService: AppointmentCheckinService,
    private readonly appointmentCreateService: AppointmentCreateService,
    private readonly appointmentSchedulingService: AppointmentSchedulingService,
    private readonly appointmentStatusService: AppointmentStatusService,
    private readonly appointmentVideoService: AppointmentVideoService,
  ) {}

  findAll(
    query?: AppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    return this.appointmentReadService.findAll(query);
  }

  findById(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentReadService.findById(id);
  }

  findOne(id: string): Promise<Appointment | null> {
    return this.appointmentEntityService.findOne(id);
  }

  update(id: string, data: Partial<Appointment>): Promise<Appointment> {
    return this.appointmentEntityService.update(id, data);
  }

  findByPatient(
    patientId: string,
    query?: PatientAppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    return this.appointmentReadService.findByPatient(patientId, query);
  }

  findByDoctor(
    doctorId: string,
    query?: PatientAppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    return this.appointmentReadService.findByDoctor(doctorId, query);
  }

  findCheckedInByDoctor(
    doctorId: string,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    return this.appointmentReadService.findCheckedInByDoctor(doctorId);
  }

  checkIn(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentCheckinService.checkIn(id);
  }

  checkInByNumber(
    appointmentNumber: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentCheckinService.checkInByNumber(appointmentNumber);
  }

  checkInVideo(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentCheckinService.checkInVideo(id);
  }

  startExamination(
    id: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentCheckinService.startExamination(id);
  }

  completeExamination(
    id: string,
    dto: CompleteExaminationDto,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentCheckinService.completeExamination(id, dto);
  }

  getDoctorQueue(doctorId: string): Promise<ResponseCommon<DoctorQueueDto>> {
    return this.appointmentStatsService.getDoctorQueue(doctorId);
  }

  getDoctorStatistics(
    doctorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ResponseCommon<AppointmentStatisticsDto>> {
    return this.appointmentStatsService.getDoctorStatistics(
      doctorId,
      startDate,
      endDate,
    );
  }

  getPatientStatistics(
    patientId: string,
  ): Promise<ResponseCommon<AppointmentStatisticsDto>> {
    return this.appointmentStatsService.getPatientStatistics(patientId);
  }

  getCalendar(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    return this.appointmentCalendarService.getCalendar(
      doctorId,
      startDate,
      endDate,
    );
  }

  create(
    data: Partial<Appointment>,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentCreateService.create(data);
  }

  updateStatus(
    id: string,
    status: AppointmentStatusEnum,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentStatusService.updateStatus(id, status);
  }

  cancel(
    id: string,
    reason: string,
    cancelledBy: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentSchedulingService.cancel(id, reason, cancelledBy);
  }

  reschedule(
    appointmentId: string,
    newTimeSlotId: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentSchedulingService.reschedule(
      appointmentId,
      newTimeSlotId,
    );
  }

  generateMeetingToken(
    appointmentId: string,
    userId: string,
    userName: string,
    isDoctor: boolean,
  ): Promise<{ token: string; url: string }> {
    return this.appointmentVideoService.generateMeetingToken(
      appointmentId,
      userId,
      userName,
      isDoctor,
    );
  }

  getUserCallStatus(userId: string): Promise<{
    inCall: boolean;
    currentCall?: {
      appointmentId: string;
      roomName: string;
      joinedAt: string;
    };
  }> {
    return this.appointmentVideoService.getUserCallStatus(userId);
  }

  leaveCall(userId: string, appointmentId: string): Promise<void> {
    return this.appointmentVideoService.leaveCall(userId, appointmentId);
  }

  confirmPayment(
    appointmentId: string,
    paymentId: string,
    paidAmount?: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentStatusService.confirmPayment(
      appointmentId,
      paymentId,
      paidAmount,
    );
  }

  updateClinicalInfo(
    appointmentId: string,
    data: {
      chiefComplaint?: string;
      symptoms?: string[];
      patientNotes?: string;
      doctorNotes?: string;
    },
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.appointmentStatusService.updateClinicalInfo(
      appointmentId,
      data,
    );
  }

  hasAnyAppointment(doctorId: string, patientId: string): Promise<boolean> {
    return this.appointmentEntityService.hasAnyAppointment(doctorId, patientId);
  }


}
