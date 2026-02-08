import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  MoreThanOrEqual,
  LessThanOrEqual,
  FindOptionsWhere,
} from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import {
  AppointmentResponseDto,
  PaginatedAppointmentResponseDto,
} from '@/modules/appointment/dto/appointment-response.dto';
import {
  AppointmentQueryDto,
  PatientAppointmentQueryDto,
} from '@/modules/appointment/dto/appointment-query.dto';
import { APPOINTMENT_BASE_RELATIONS } from '@/modules/appointment/appointment.constants';
import { AppointmentMapperService } from '@/modules/appointment/services/appointment-mapper.service';

import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';

@Injectable()
export class AppointmentReadService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(MedicalRecord)
    private readonly medicalRecordRepository: Repository<MedicalRecord>,
    private readonly mapper: AppointmentMapperService,
  ) {}

  async findAll(
    query?: AppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Appointment> = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.appointmentType) {
      where.appointmentType = query.appointmentType;
    }

    if (query?.startDate && query?.endDate) {
      where.scheduledAt = Between(
        new Date(query.startDate),
        new Date(query.endDate),
      );
    } else if (query?.startDate) {
      where.scheduledAt = MoreThanOrEqual(new Date(query.startDate));
    } else if (query?.endDate) {
      where.scheduledAt = LessThanOrEqual(new Date(query.endDate));
    }

    const [appointments, totalItems] =
      await this.appointmentRepository.findAndCount({
        where,
        relations: APPOINTMENT_BASE_RELATIONS,
        order: { scheduledAt: 'DESC' },
        skip,
        take: limit,
      });

    const totalPages = Math.ceil(totalItems / limit);

    return new ResponseCommon(200, 'SUCCESS', {
      items: appointments.map((a) => this.mapper.toDto(a)),
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  }

  async findById(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id },
      relations: APPOINTMENT_BASE_RELATIONS,
    });
    if (!appointment) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }

    const dto = this.mapper.toDto(appointment);

    // Try to find associated medical record ID
    const medicalRecord = await this.medicalRecordRepository.findOne({
      where: { appointmentId: id },
      select: ['id'],
    });

    if (medicalRecord) {
      dto.medicalRecordId = medicalRecord.id;
    }

    return new ResponseCommon(200, 'SUCCESS', dto);
  }

  async findByPatient(
    patientId: string,
    query?: PatientAppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Appointment> = { patientId };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.startDate && query?.endDate) {
      where.scheduledAt = Between(
        new Date(query.startDate),
        new Date(query.endDate),
      );
    } else if (query?.startDate) {
      where.scheduledAt = MoreThanOrEqual(new Date(query.startDate));
    } else if (query?.endDate) {
      where.scheduledAt = LessThanOrEqual(new Date(query.endDate));
    }

    const [appointments, totalItems] =
      await this.appointmentRepository.findAndCount({
        where,
        relations: APPOINTMENT_BASE_RELATIONS,
        order: { scheduledAt: 'DESC' },
        skip,
        take: limit,
      });

    const totalPages = Math.ceil(totalItems / limit);

    return new ResponseCommon(200, 'SUCCESS', {
      items: appointments.map((a) => this.mapper.toDto(a)),
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  }

  async findByDoctor(
    doctorId: string,
    query?: PatientAppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Appointment> = { doctorId };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.startDate && query?.endDate) {
      where.scheduledAt = Between(
        new Date(query.startDate),
        new Date(query.endDate),
      );
    } else if (query?.startDate) {
      where.scheduledAt = MoreThanOrEqual(new Date(query.startDate));
    } else if (query?.endDate) {
      where.scheduledAt = LessThanOrEqual(new Date(query.endDate));
    }

    const [appointments, totalItems] =
      await this.appointmentRepository.findAndCount({
        where,
        relations: APPOINTMENT_BASE_RELATIONS,
        order: { scheduledAt: 'DESC' },
        skip,
        take: limit,
      });

    const totalPages = Math.ceil(totalItems / limit);

    return new ResponseCommon(200, 'SUCCESS', {
      items: appointments.map((a) => this.mapper.toDto(a)),
      meta: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  }

  async findCheckedInByDoctor(
    doctorId: string,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        status: AppointmentStatusEnum.CHECKED_IN,
      },
      relations: APPOINTMENT_BASE_RELATIONS,
      order: { scheduledAt: 'DESC' },
    });

    return new ResponseCommon(
      200,
      'SUCCESS',
      appointments.map((a) => this.mapper.toDto(a)),
    );
  }
}
