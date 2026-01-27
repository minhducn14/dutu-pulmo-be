import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './entities/patient.entity';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { AppointmentService } from '../appointment/appointment.service';
import { PatientQueryDto, UpdatePatientDto } from './dto/patient.dto';
import { AppointmentStatusEnum } from '../common/enums/appointment-status.enum';

export interface PaginatedPatientResponseDto {
  items: Patient[];
  meta: {
    currentPage: number;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(Patient)
    private readonly patientRepository: Repository<Patient>,
    private readonly appointmentService: AppointmentService,
  ) {}

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Get all patients with pagination and search
   */
  async findAll(
    query?: PatientQueryDto,
  ): Promise<ResponseCommon<PaginatedPatientResponseDto>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    let queryBuilder = this.patientRepository
      .createQueryBuilder('patient')
      .leftJoinAndSelect('patient.user', 'user');

    // Search by user name, phone, or profile code
    if (query?.search) {
      queryBuilder = queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR user.phone ILIKE :search OR patient.profileCode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Filter by blood type
    if (query?.bloodType) {
      queryBuilder = queryBuilder.andWhere('patient.bloodType = :bloodType', {
        bloodType: query.bloodType,
      });
    }

    const totalItems = await queryBuilder.getCount();

    const patients = await queryBuilder
      .orderBy('patient.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(totalItems / limit);

    return new ResponseCommon(200, 'SUCCESS', {
      items: patients,
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

  /**
   * Get patient by ID with user info
   */
  async findOne(id: string): Promise<ResponseCommon<Patient>> {
    const patient = await this.patientRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Bệnh nhân không tồn tại');
    }

    return new ResponseCommon(200, 'SUCCESS', patient);
  }

  /**
   * Get patient by user ID
   */
  async findByUserId(userId: string): Promise<ResponseCommon<Patient>> {
    const patient = await this.patientRepository.findOne({
      where: { userId },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Bệnh nhân không tồn tại');
    }

    return new ResponseCommon(200, 'SUCCESS', patient);
  }

  /**
   * Update patient information
   */
  async update(
    id: string,
    dto: UpdatePatientDto,
  ): Promise<ResponseCommon<Patient>> {
    const patient = await this.patientRepository.findOne({ where: { id } });

    if (!patient) {
      throw new NotFoundException('Bệnh nhân không tồn tại');
    }

    // Build update data, handling Date conversion for insuranceExpiry
    const { insuranceExpiry, ...rest } = dto;
    const updateData: Partial<Patient> = { ...rest };

    if (insuranceExpiry) {
      updateData.insuranceExpiry = new Date(insuranceExpiry);
    }

    await this.patientRepository.update(id, updateData);
    return this.findOne(id);
  }

  /**
   * Get patient's appointments with pagination
   */
  async getAppointments(
    patientId: string,
    query?: { page?: number; limit?: number; status?: AppointmentStatusEnum },
  ): Promise<ResponseCommon> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException('Bệnh nhân không tồn tại');
    }

    return this.appointmentService.findByPatient(patientId, {
      page: query?.page || 1,
      limit: query?.limit || 10,
      status: query?.status,
    });
  }

  // ============================================================================
  // PROFILE SUMMARY
  // ============================================================================

  async getProfile(patientId: string): Promise<ResponseCommon> {
    const patient = await this.patientRepository.findOne({
      where: { id: patientId },
      relations: ['user'],
    });

    if (!patient) {
      throw new NotFoundException('Bệnh nhân không tồn tại');
    }

    
    return new ResponseCommon(200, 'SUCCESS', {
      patient,
      summary: {
        totalMedicalRecords: 0,
        totalVitalSigns: 0,
        totalPrescriptions: 0,
        latestVitalSign: null,
      },
    });
  }
}
