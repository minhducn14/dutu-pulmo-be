import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { Brackets, Repository } from 'typeorm';
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
import { applyPaginationAndSort } from '@/common/utils/pagination.util';

@Injectable()
export class AppointmentReadService {
  private readonly logger = new Logger(AppointmentReadService.name);
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
    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.user', 'patientUser')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.user', 'doctorUser');

    if (query?.status) {
      qb.andWhere('appointment.status = :status', { status: query.status });
    }

    if (query?.appointmentType) {
      qb.andWhere('appointment.appointmentType = :appointmentType', {
        appointmentType: query.appointmentType,
      });
    }

    if (query?.startDate && query?.endDate) {
      qb.andWhere('appointment.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      });
    } else if (query?.startDate) {
      qb.andWhere('appointment.scheduledAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    } else if (query?.endDate) {
      qb.andWhere('appointment.scheduledAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    // Apply pagination and sort mapping
    applyPaginationAndSort(
      qb,
      query || {},
      ['scheduledAt', 'createdAt', 'status', 'appointmentType'],
      'scheduledAt',
      'DESC',
    );

    const [appointments, totalItems] = await qb.getManyAndCount();
    const limit = query?.limit || 10;
    const page = query?.page || 1;
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
      this.logger.error('Appointment not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
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
    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.user', 'patientUser')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.user', 'doctorUser')
      .where('appointment.patientId = :patientId', { patientId });

    if (query?.search) {
      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery
            .where('UPPER(patientUser.fullName) LIKE :search', {
              search: `%${query.search?.toUpperCase()}%`,
            })
            .orWhere('UPPER(doctorUser.fullName) LIKE :search', {
              search: `%${query.search?.toUpperCase()}%`,
            })
            .orWhere('UPPER(appointment.appointmentNumber) LIKE :search', {
              search: `%${query.search?.toUpperCase()}%`,
            });
        }),
      );
    }

    if (query?.status) {
      qb.andWhere('appointment.status = :status', { status: query.status });
    }

    const startDate = query?.startDate ? new Date(query.startDate) : null;
    const endDate = query?.endDate ? new Date(query.endDate) : null;

    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }
    if (startDate && endDate) {
      qb.andWhere('appointment.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere('appointment.scheduledAt >= :startDate', {
        startDate,
      });
    } else if (endDate) {
      qb.andWhere('appointment.scheduledAt <= :endDate', {
        endDate,
      });
    }

    // Apply pagination and sort mapping
    applyPaginationAndSort(
      qb,
      query || {},
      ['scheduledAt', 'createdAt', 'updatedAt', 'status'],
      'scheduledAt',
      'DESC',
    );

    const [appointments, totalItems] = await qb.getManyAndCount();
    const limit = query?.limit || 10;
    const page = query?.page || 1;
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
    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('patient.user', 'patientUser')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .leftJoinAndSelect('doctor.user', 'doctorUser')
      .where('appointment.doctorId = :doctorId', { doctorId });

    if (query?.status) {
      qb.andWhere('appointment.status = :status', { status: query.status });
    }
    const startDate = query?.startDate ? new Date(query.startDate) : null;
    const endDate = query?.endDate ? new Date(query.endDate) : null;
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }
    if (startDate && endDate) {
      qb.andWhere('appointment.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    } else if (startDate) {
      qb.andWhere('appointment.scheduledAt >= :startDate', {
        startDate,
      });
    } else if (endDate) {
      qb.andWhere('appointment.scheduledAt <= :endDate', {
        endDate,
      });
    }

    // Apply pagination and sort mapping
    applyPaginationAndSort(
      qb,
      query || {},
      ['scheduledAt', 'createdAt', 'status'],
      'scheduledAt',
      'DESC',
    );

    const [appointments, totalItems] = await qb.getManyAndCount();
    const limit = query?.limit || 10;
    const page = query?.page || 1;
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
