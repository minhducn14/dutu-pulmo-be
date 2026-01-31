import { Injectable } from '@nestjs/common';
import { ResponseCommon } from '@/common/dto/response.dto';
import {
  AppointmentResponseDto,
  PaginatedAppointmentResponseDto,
} from '@/modules/appointment/dto/appointment-response.dto';
import {
  AppointmentQueryDto,
  PatientAppointmentQueryDto,
} from '@/modules/appointment/dto/appointment-query.dto';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentReadService } from '@/modules/appointment/services/appointment-read.service';
import { AppointmentEntityService } from '@/modules/appointment/services/appointment-entity.service';
import { AppointmentCreateService } from '@/modules/appointment/services/appointment-create.service';
import { AppointmentSchedulingService } from '@/modules/appointment/services/appointment-scheduling.service';
import { AppointmentStatusService } from '@/modules/appointment/services/appointment-status.service';

@Injectable()
export class AppointmentService {
  constructor(
    private readonly appointmentReadService: AppointmentReadService,
    private readonly appointmentEntityService: AppointmentEntityService,
    private readonly appointmentCreateService: AppointmentCreateService,
    private readonly appointmentSchedulingService: AppointmentSchedulingService,
    private readonly appointmentStatusService: AppointmentStatusService,
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

  hasAnyAppointment(doctorId: string, patientId: string): Promise<boolean> {
    return this.appointmentEntityService.hasAnyAppointment(doctorId, patientId);
  }

}
