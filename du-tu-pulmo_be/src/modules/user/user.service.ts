import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';
import { UpdateUserDto } from '@/modules/user/dto/update-user.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { UserQueryDto } from '@/modules/user/dto/user-query.dto';
import { UserResponseDto } from '@/modules/user/dto/user-response.dto';
import { CloudinaryService } from '@/modules/cloudinary';
import { applyPaginationAndSort } from '@/common/utils/pagination.util';
import { Account } from '@/modules/account/entities/account.entity';
import { ChangePasswordDto } from '@/modules/user/dto/change-password.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,

    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async findAll(query?: UserQueryDto): Promise<
    ResponseCommon<{
      items: User[];
      meta: {
        currentPage: number;
        itemsPerPage: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    }>
  > {
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

    applyPaginationAndSort(
      queryBuilder,
      query || {},
      ['createdAt', 'fullName', 'phone', 'status'],
      'createdAt',
      'DESC',
    );

    const [users, totalItems] = await queryBuilder.getManyAndCount();
    const limit = query?.limit || 10;
    const page = query?.page || 1;
    const totalPages = Math.ceil(totalItems / limit);

    return new ResponseCommon(200, 'SUCCESS', {
      items: users,
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

  async findOne(id: string): Promise<ResponseCommon<User>> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['account'],
    });
    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
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

    return new ResponseCommon(200, 'SUCCESS', user);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
  ): Promise<ResponseCommon<User>> {
    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
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
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    await this.userRepository.softDelete(id);
    return new ResponseCommon(200, 'SUCCESS', {
      message: 'Xóa user thành công',
    });
  }

  async updateAvatar(userId: string, file: Express.Multer.File) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);

    const uploaded = await this.cloudinaryService.uploadAvatar(file, userId);
    // if (user.avatarPublicId) {
    //   try {
    //     await this.cloudinaryService.deleteImage(user.avatarPublicId);
    //   } catch {
    //     // Ignore cleanup error for old avatar and continue update flow.
    //   }
    // }

    user.avatarUrl = uploaded.url;
    user.avatarPublicId = uploaded.publicId;

    const saved = await this.userRepository.save(user);

    return {
      user: UserResponseDto.fromEntity(saved),
      upload: uploaded,
    };
  }

  async addFcmToken(userId: string, token: string): Promise<ResponseCommon> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (!user.fcmTokens) {
      user.fcmTokens = [];
    }

    // Only add if not already in the array
    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token);
      await this.userRepository.save(user);
    }

    return new ResponseCommon(200, 'SUCCESS', {
      message: 'FCM Token added successfully',
    });
  }

  async removeFcmToken(userId: string, token: string): Promise<ResponseCommon> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
    }

    if (user.fcmTokens && user.fcmTokens.includes(token)) {
      user.fcmTokens = user.fcmTokens.filter((t) => t !== token);
      await this.userRepository.save(user);
    }

    return new ResponseCommon(200, 'SUCCESS', {
      message: 'FCM Token removed successfully',
    });
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<ResponseCommon> {
    const account = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.account', 'account')
      .addSelect('account.password')
      .where('user.id = :userId', { userId })
      .getOne()
      .then((u) => u?.account);

    if (!account) {
      throw new NotFoundException(ERROR_MESSAGES.ACCOUNT_NOT_FOUND);
    }

    const isPasswordMatching = await bcrypt.compare(
      dto.oldPassword,
      account.password,
    );

    if (!isPasswordMatching) {
      throw new BadRequestException(
        ERROR_MESSAGES.INVALID_OLD_PASSWORD ||
          'Mật khẩu hiện tại không chính xác',
      );
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận không khớp');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.manager.update(Account, account.id, {
      password: hashedPassword,
    });

    return new ResponseCommon(200, 'SUCCESS', {
      message: 'Đổi mật khẩu thành công',
    });
  }
}
