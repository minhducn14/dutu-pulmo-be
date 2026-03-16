import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Account } from '@/modules/account/entities/account.entity';
import { User } from '@/modules/user/entities/user.entity';
import { FindDoctorsQueryDto } from '@/modules/doctor/dto/find-doctors.dto';
import { CreateDoctorDto } from '@/modules/doctor/dto/create-doctor.dto';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { UpdateDoctorDto } from '@/modules/doctor/dto/update-doctor.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { VerificationStatus } from '@/modules/common/enums/doctor-verification-status.enum';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { applyPaginationAndSort } from '@/common/utils/pagination.util';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { mapAppointmentTypeFilterToSlotType } from '@/modules/doctor/dto/appointment-type-filter.enum';
import { vnNow } from '@/common/datetime';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(Account)
    private readonly accountRepository: Repository<Account>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<ResponseCommon<Doctor[]>> {
    const doctors = await this.doctorRepository.find({
      relations: ['user', 'primaryHospital'],
    });
    return new ResponseCommon(200, 'SUCCESS', doctors);
  }

  async findAllPaginated(
    dto: FindDoctorsQueryDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<Doctor>>> {
    const { search, specialty, hospitalId, appointmentType } = dto;
    const now = vnNow();
    const appointmentSlotType =
      mapAppointmentTypeFilterToSlotType(appointmentType);

    const queryBuilder = this.doctorRepository
      .createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.user', 'user')
      .leftJoinAndSelect('user.account', 'account')
      .leftJoinAndSelect('doctor.primaryHospital', 'primaryHospital');

    // Tìm kiếm theo tên bác sĩ (từ user.fullName) hoặc bio
    if (search) {
      queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR doctor.bio ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    // Lọc theo chuyên khoa
    if (specialty) {
      queryBuilder.andWhere('doctor.specialty = :specialty', { specialty });
    }

    // Lọc theo bệnh viện
    if (hospitalId) {
      queryBuilder.andWhere('doctor.primaryHospitalId = :hospitalId', {
        hospitalId,
      });
    }

    if (appointmentSlotType) {
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1
          FROM time_slots slot
          WHERE slot.doctor_id = doctor.id
            AND slot.deleted_at IS NULL
            AND slot.start_time >= :slotNow
            AND slot.is_available = true
            AND slot.booked_count < slot.capacity
            AND :slotType = ANY(slot.allowed_appointment_types)
        )`,
        {
          slotNow: now,
          slotType: appointmentSlotType,
        },
      );
    }

    applyPaginationAndSort(
      queryBuilder,
      dto,
      ['createdAt', 'specialty', 'practiceStartYear', 'defaultConsultationFee'],
      'createdAt',
      'DESC',
    );

    const [items, totalItems] = await queryBuilder.getManyAndCount();
    const availabilityMap = await this.getDoctorAvailabilityMap(
      items.map((item) => item.id),
    );
    const withAvailability = items.map((doctor) =>
      Object.assign(
        doctor,
        availabilityMap.get(doctor.id) ?? {
          hasOnlineFutureSlots: false,
          hasOfflineFutureSlots: false,
        },
      ),
    );
    const limit = dto.limit || 10;
    const page = dto.page || 1;

    const paginatedData = new PaginatedResponseDto(
      withAvailability,
      totalItems,
      page,
      limit,
    );
    return new ResponseCommon(200, 'SUCCESS', paginatedData);
  }

  async findOne(id: string): Promise<ResponseCommon<Doctor | null>> {
    const doctor = await this.doctorRepository.findOne({
      where: { id },
      relations: ['user', 'primaryHospital', 'user.account'],
    });
    if (!doctor) {
      return new ResponseCommon(200, 'SUCCESS', null);
    }

    const availabilityMap = await this.getDoctorAvailabilityMap([doctor.id]);
    const availability = availabilityMap.get(doctor.id) ?? {
      hasOnlineFutureSlots: false,
      hasOfflineFutureSlots: false,
    };

    return new ResponseCommon(
      200,
      'SUCCESS',
      Object.assign(doctor, availability),
    );
  }

  async findByUserId(userId: string): Promise<ResponseCommon<Doctor | null>> {
    const doctor = await this.doctorRepository.findOne({
      where: { userId },
      relations: ['user', 'primaryHospital'],
    });
    return new ResponseCommon(200, 'SUCCESS', doctor);
  }

  private async getDoctorAvailabilityMap(doctorIds: string[]): Promise<
    Map<
      string,
      {
        hasOnlineFutureSlots: boolean;
        hasOfflineFutureSlots: boolean;
      }
    >
  > {
    const map = new Map<
      string,
      {
        hasOnlineFutureSlots: boolean;
        hasOfflineFutureSlots: boolean;
      }
    >();

    if (doctorIds.length === 0) {
      return map;
    }

    const now = vnNow();
    const rows = await this.timeSlotRepository
      .createQueryBuilder('slot')
      .select('slot.doctorId', 'doctorId')
      .addSelect(
        `BOOL_OR(:videoType = ANY(slot.allowedAppointmentTypes))`,
        'hasOnlineFutureSlots',
      )
      .addSelect(
        `BOOL_OR(:offlineType = ANY(slot.allowedAppointmentTypes))`,
        'hasOfflineFutureSlots',
      )
      .where('slot.doctorId IN (:...doctorIds)', { doctorIds })
      .andWhere('slot.startTime >= :now', { now })
      .andWhere('slot.isAvailable = true')
      .andWhere('slot.bookedCount < slot.capacity')
      .groupBy('slot.doctorId')
      .setParameters({
        videoType: AppointmentTypeEnum.VIDEO,
        offlineType: AppointmentTypeEnum.IN_CLINIC,
      })
      .getRawMany<{
        doctorId: string;
        hasOnlineFutureSlots: boolean | 'true' | 'false';
        hasOfflineFutureSlots: boolean | 'true' | 'false';
      }>();

    for (const row of rows) {
      map.set(row.doctorId, {
        hasOnlineFutureSlots:
          row.hasOnlineFutureSlots === true ||
          row.hasOnlineFutureSlots === 'true',
        hasOfflineFutureSlots:
          row.hasOfflineFutureSlots === true ||
          row.hasOfflineFutureSlots === 'true',
      });
    }

    return map;
  }

  async create(dto: CreateDoctorDto): Promise<ResponseCommon<Doctor>> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Validate phone number format
    if (dto.phone) {
      const vietnamesePhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
      if (!vietnamesePhoneRegex.test(dto.phone)) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_PHONE_FORMAT);
      }
    }

    // Use transaction for data consistency
    const doctor = await this.dataSource.transaction(async (manager) => {
      // Check email existence with pessimistic lock
      const existingAccount = await manager
        .getRepository(Account)
        .createQueryBuilder('a')
        .where('a.email = :email', { email: normalizedEmail })
        .setLock('pessimistic_write')
        .getOne();

      if (existingAccount) {
        throw new ConflictException(ERROR_MESSAGES.EMAIL_ALREADY_REGISTERED);
      }

      // Check phone existence
      if (dto.phone) {
        const existingPhone = await manager
          .getRepository(User)
          .createQueryBuilder('u')
          .where('u.phone = :phone', { phone: dto.phone })
          .setLock('pessimistic_write')
          .getOne();

        if (existingPhone) {
          throw new ConflictException(ERROR_MESSAGES.PHONE_ALREADY_USED);
        }
      }

      // Check license number uniqueness
      if (dto.licenseNumber) {
        const existingByLicense = await manager.findOne(Doctor, {
          where: { licenseNumber: dto.licenseNumber },
        });
        if (existingByLicense) {
          throw new ConflictException(ERROR_MESSAGES.LICENSE_ALREADY_EXISTS);
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(dto.password, 12);

      // Create User
      const user = manager.create(User, {
        email: normalizedEmail,
        phone: dto.phone,
        fullName: dto.fullName,
      });
      await manager.save(user);

      // Create Account with DOCTOR role
      const account = manager.create(Account, {
        email: normalizedEmail,
        password: hashedPassword,
        isVerified: true,
        verifiedAt: new Date(),
        verificationStatus: VerificationStatus.VERIFIED,
        roles: [RoleEnum.DOCTOR],
        user: user,
      });
      await manager.save(account);

      // Create Doctor profile
      const newDoctor = manager.create(Doctor, {
        userId: user.id,
        user: user,
        licenseNumber: dto.licenseNumber,
        practiceStartYear: dto.practiceStartYear,
        title: dto.title,
        position: dto.position,
        specialty: dto.specialty,
        bio: dto.bio,
        licenseImageUrls: dto.licenseImageUrls,
        defaultConsultationFee: dto.defaultConsultationFee?.toString() ?? null,
      });
      await manager.save(newDoctor);

      this.logger.log(
        `Doctor created: ${normalizedEmail} - License: ${dto.licenseNumber}`,
      );

      return newDoctor;
    });

    return new ResponseCommon(201, 'Tạo bác sĩ thành công', doctor);
  }

  async update(
    id: string,
    dto: UpdateDoctorDto,
  ): Promise<ResponseCommon<Doctor | null>> {
    const doctor = await this.doctorRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!doctor) {
      throw new NotFoundException(ERROR_MESSAGES.DOCTOR_NOT_FOUND_ID);
    }

    const {
      fullName,
      phone,
      dateOfBirth,
      gender,
      CCCD,
      provinceCode,
      province,
      wardCode,
      ward,
      address,
      ...doctorFields
    } = dto;

    await this.dataSource.transaction(async (manager) => {
      const userUpdateData: Partial<User> = {};
      if (fullName !== undefined) userUpdateData.fullName = fullName;
      if (phone !== undefined) userUpdateData.phone = phone;
      if (dateOfBirth !== undefined)
        userUpdateData.dateOfBirth = new Date(dateOfBirth);
      if (gender !== undefined) userUpdateData.gender = gender;
      if (CCCD !== undefined) userUpdateData.CCCD = CCCD;
      if (provinceCode !== undefined)
        userUpdateData.provinceCode = provinceCode;
      if (province !== undefined) userUpdateData.province = province;
      if (wardCode !== undefined) userUpdateData.wardCode = wardCode;
      if (ward !== undefined) userUpdateData.ward = ward;
      if (address !== undefined) userUpdateData.address = address;

      if (Object.keys(userUpdateData).length > 0) {
        await manager.update(User, doctor.userId, userUpdateData);
      }

      if (Object.keys(doctorFields).length > 0) {
        await manager.update(Doctor, id, doctorFields);
      }
    });

    const updated = await this.doctorRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'Cập nhật bác sĩ thành công', updated);
  }

  async remove(
    id: string,
    deletedBy: string,
    reason?: string,
  ): Promise<ResponseCommon<null>> {
    const doctor = await this.doctorRepository.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!doctor) {
      throw new NotFoundException(ERROR_MESSAGES.DOCTOR_NOT_FOUND_ID);
    }

    this.logger.log(
      `Admin ${deletedBy} deleting doctor ${id}, reason: ${reason || 'No reason provided'}`,
    );

    await this.doctorRepository.softDelete(id);

    return new ResponseCommon(200, 'SUCCESS', null);
  }

  async findDeleted(): Promise<ResponseCommon<Doctor[]>> {
    const doctors = await this.doctorRepository.find({
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true,
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', doctors);
  }

  async restore(id: string): Promise<ResponseCommon<Doctor | null>> {
    await this.doctorRepository.restore(id);
    const doctor = await this.doctorRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    return new ResponseCommon(200, 'SUCCESS', doctor);
  }
}

