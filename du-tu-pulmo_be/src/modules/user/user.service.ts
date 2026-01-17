import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { Account } from '../account/entities/account.entity';
import { USER_ERRORS } from 'src/common/constants/error-messages.constant';
import { RoleEnum } from '../common/enums/role.enum';
import { Doctor } from '../doctor/entities/doctor.entity';
import { Patient } from '../patient/entities/patient.entity';
import { UserQueryDto } from './dto/user-query.dto';
import { PaginatedUserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
  ) {}

  async findAll(
    query?: UserQueryDto,
  ): Promise<ResponseCommon<PaginatedUserResponseDto>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    // Build query with search
    let queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.account', 'account');

    // Search by name, phone
    if (query?.search) {
      queryBuilder = queryBuilder.andWhere(
        '(user.fullName ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    // Filter by role
    if (query?.role) {
      queryBuilder = queryBuilder.andWhere(':role = ANY(account.roles)', {
        role: query.role,
      });
    }

    // Filter by status
    if (query?.status) {
      queryBuilder = queryBuilder.andWhere('user.status = :status', {
        status: query.status,
      });
    }

    // Get total count and apply pagination
    const totalItems = await queryBuilder.getCount();

    const users = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const totalPages = Math.ceil(totalItems / limit);
    const safeUsers = users.map((user) => this.sanitizeUser(user));

    return new ResponseCommon(200, 'SUCCESS', {
      items: safeUsers as any,
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

  async findOne(id: string): Promise<ResponseCommon> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['account'],
    });
    if (!user) {
      throw new NotFoundException(USER_ERRORS.USER_NOT_FOUND);
    }
    // Nếu role là doctor thì lấy thông tin doctor
    if (user.account.roles.includes(RoleEnum.DOCTOR)) {
      user.doctor = await this.doctorRepository.findOne({
        where: { userId: id },
      });
    }

    // Nếu role là patient thì lấy thông tin patient
    if (user.account.roles.includes(RoleEnum.PATIENT)) {
      user.patient = await this.patientRepository.findOne({
        where: { userId: id },
      });
    }

    return new ResponseCommon(200, 'SUCCESS', this.sanitizeUser(user));
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<ResponseCommon> {
    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(USER_ERRORS.USER_NOT_FOUND);
    }

    const { dateOfBirth, ...rest } = updateUserDto;
    const updateData: Partial<User> = { ...rest };
    if (dateOfBirth) {
      updateData.dateOfBirth = new Date(dateOfBirth);
    }

    await this.userRepository.update(id, updateData);
    return this.findOne(id);
  }

  async remove(id: string): Promise<ResponseCommon> {
    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(USER_ERRORS.USER_NOT_FOUND);
    }

    await this.userRepository.softDelete(id);
    return new ResponseCommon(200, 'SUCCESS', {
      message: 'Xóa user thành công',
    });
  }

  /**
   * Sanitize user data - loại bỏ thông tin nhạy cảm
   */
  private sanitizeUser(user: User): Partial<User> {
    const { account, ...safeUser } = user;

    if (account) {
      return {
        ...safeUser,
        account: {
          id: account.id,
          email: account.email,
          isVerified: account.isVerified,
          roles: account.roles,
          status: account.status,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        } as any,
      };
    }

    return safeUser;
  }
}
