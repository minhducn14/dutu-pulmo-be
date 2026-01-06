import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not, IsNull } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Doctor } from './entities/doctor.entity';
// import { SubSpecialty } from '../specialty/entities/sub-specialty.entity';
import { Account } from '../account/entities/account.entity';
import { User } from '../user/entities/user.entity';
import { FindDoctorsDto } from './dto/find-doctors.dto';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { PaginatedResponseDto } from 'src/common/dto/pagination.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { RoleEnum } from '../common/enums/role.enum';
import { VerificationStatus } from '../common/enums/doctor-verification-status.enum';

@Injectable()
export class DoctorService {
  private readonly logger = new Logger(DoctorService.name);

  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
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

  async findAllPaginated(dto: FindDoctorsDto): Promise<ResponseCommon<PaginatedResponseDto<Doctor>>> {
    const { page = 1, limit = 10, search, specialty, hospitalId } = dto;
    const skip = (page - 1) * limit;

    const queryBuilder = this.doctorRepository.createQueryBuilder('doctor')
      .leftJoinAndSelect('doctor.user', 'user')
      .leftJoinAndSelect('user.account', 'account')
      .leftJoinAndSelect('doctor.primaryHospital', 'primaryHospital');

    // Tìm kiếm theo tên bác sĩ (từ user.fullName) hoặc bio
    if (search) {
      queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR doctor.bio ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    // Lọc theo chuyên khoa
    if (specialty) {
      queryBuilder.andWhere('doctor.specialty = :specialty', { specialty });
    }

    // Lọc theo bệnh viện
    if (hospitalId) {
      queryBuilder.andWhere('doctor.primaryHospitalId = :hospitalId', { hospitalId });
    }

    // Sắp xếp và phân trang
    queryBuilder
      .orderBy('doctor.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [items, totalItems] = await queryBuilder.getManyAndCount();

    const paginatedData = new PaginatedResponseDto(items, totalItems, page, limit);
    return new ResponseCommon(200, 'SUCCESS', paginatedData);
  }

  async findOne(id: string): Promise<ResponseCommon<Doctor | null>> {
    const doctor = await this.doctorRepository.findOne({
      where: { id },
      relations: ['user', 'primaryHospital'],
    });
    return new ResponseCommon(200, 'SUCCESS', doctor);
  }

  async findByUserId(userId: string): Promise<ResponseCommon<Doctor | null>> {
    const doctor = await this.doctorRepository.findOne({
      where: { userId },
      relations: ['user', 'primaryHospital'],
    });
    return new ResponseCommon(200, 'SUCCESS', doctor);
  }

  async create(dto: CreateDoctorDto): Promise<ResponseCommon<Doctor>> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Validate phone number format
    if (dto.phone) {
      const vietnamesePhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
      if (!vietnamesePhoneRegex.test(dto.phone)) {
        throw new BadRequestException(
          'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (VD: 0912345678)',
        );
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
        throw new ConflictException('Email đã được đăng ký');
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
          throw new ConflictException('Số điện thoại đã được sử dụng');
        }
      }

      // Check license number uniqueness
      if (dto.licenseNumber) {
        const existingByLicense = await manager.findOne(Doctor, {
          where: { licenseNumber: dto.licenseNumber },
        });
        if (existingByLicense) {
          throw new ConflictException(
            `Số giấy phép hành nghề ${dto.licenseNumber} đã tồn tại`,
          );
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

      this.logger.log(`Doctor created: ${normalizedEmail} - License: ${dto.licenseNumber}`);

      return newDoctor;
    });

    return new ResponseCommon(201, 'Tạo bác sĩ thành công', doctor);
  }

  async update(id: string, dto: UpdateDoctorDto): Promise<ResponseCommon<Doctor | null>> {
    const doctor = await this.doctorRepository.findOne({ 
      where: { id },
      relations: ['user'],
    });
    if (!doctor) {
      throw new NotFoundException(`Không tìm thấy bác sĩ với ID ${id}`);
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
      if (dateOfBirth !== undefined) userUpdateData.dateOfBirth = new Date(dateOfBirth);
      if (gender !== undefined) userUpdateData.gender = gender;
      if (CCCD !== undefined) userUpdateData.CCCD = CCCD;
      if (provinceCode !== undefined) userUpdateData.provinceCode = provinceCode;
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
      throw new NotFoundException(`Không tìm thấy bác sĩ với ID ${id}`);
    }

    this.logger.log(`Admin ${deletedBy} deleting doctor ${id}, reason: ${reason || 'No reason provided'}`);

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
