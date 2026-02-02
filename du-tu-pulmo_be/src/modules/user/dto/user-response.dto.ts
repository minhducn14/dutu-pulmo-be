import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatusEnum } from '@/modules/common/enums/user-status.enum';
import { GenderEnum } from '@/modules/common/enums/gender.enum';
import { CountryEnum } from '@/modules/common/enums/country.enum';
import { EthnicityEnum, EthnicityName } from '@/modules/common/enums/ethnicity.enum';
import { OccupationEnum, OccupationName } from '@/modules/common/enums/job.enum';

export class UserResponseDto {
  @ApiProperty({
    example: 'b7c1cf97-6734-43ae-9a62-0f97b48f5123',
    description: 'ID của user',
  })
  id: string;

  @ApiPropertyOptional({
    example: 'Nguyễn Văn A',
    description: 'Họ tên đầy đủ',
  })
  fullName?: string;

  @ApiPropertyOptional({
    example: '0912345678',
    description: 'Số điện thoại',
  })
  phone?: string;

  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email',
  })
  email?: string;

  @ApiPropertyOptional({
    example: '1990-01-15',
    description: 'Ngày sinh',
  })
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    enum: GenderEnum,
    example: GenderEnum.MALE,
    description: 'Giới tính',
  })
  gender?: GenderEnum;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: 'URL avatar',
  })
  avatarUrl?: string;

  @ApiProperty({
    enum: UserStatusEnum,
    example: UserStatusEnum.ACTIVE,
    description: 'Trạng thái tài khoản',
  })
  status: UserStatusEnum;

  @ApiPropertyOptional({
    example: '079123456789',
    description: 'Số CCCD',
  })
  CCCD?: string;

  @ApiPropertyOptional({
    enum: CountryEnum,
    example: CountryEnum.VIET_NAM,
    description: 'Quốc tịch',
  })
  nationality?: CountryEnum;

  @ApiPropertyOptional({
    example: 'Việt Nam',
    description: 'Tên quốc gia',
  })
  nationalityName?: string;

  @ApiPropertyOptional({
    enum: EthnicityEnum,
    example: EthnicityEnum.KINH,
    description: 'Dân tộc',
  })
  ethnicity?: EthnicityEnum;

  @ApiPropertyOptional({
    example: 'Kinh',
    description: 'Tên dân tộc',
  })
  ethnicityName?: string;

  @ApiPropertyOptional({
    enum: OccupationEnum,
    example: OccupationEnum.JOB_22110,
    description: 'Nghề nghiệp',
  })
  occupation?: OccupationEnum;

  @ApiPropertyOptional({
    example: 'Khai thác thủy sản',
    description: 'Tên nghề nghiệp',
  })
  occupationName?: string;

  // Địa chỉ
  @ApiPropertyOptional({
    example: '01',
    description: 'Mã Tỉnh/Thành phố',
  })
  provinceCode?: string;

  @ApiPropertyOptional({
    example: 'Hồ Chí Minh',
    description: 'Tỉnh/Thành phố',
  })
  province?: string;

  @ApiPropertyOptional({
    example: '00001',
    description: 'Mã Phường/Xã',
  })
  wardCode?: string;

  @ApiPropertyOptional({
    example: 'Phường Bến Nghé',
    description: 'Phường/Xã',
  })
  ward?: string;

  @ApiPropertyOptional({
    example: '123 Đường Nguyễn Huệ',
    description: 'Địa chỉ chi tiết',
  })
  address?: string;

  @ApiPropertyOptional({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Thời gian hoạt động cuối',
  })
  lastActiveAt?: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Thời gian tạo tài khoản',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Thời gian cập nhật cuối',
  })
  updatedAt: Date;

  static fromEntity(user: {
    id: string;
    fullName?: string;
    phone?: string;
    email?: string;
    account?: { email: string };
    dateOfBirth?: Date;
    gender?: GenderEnum;
    avatarUrl?: string;
    status: UserStatusEnum;
    CCCD?: string;
    nationality?: CountryEnum;
    ethnicity?: EthnicityEnum;
    occupation?: OccupationEnum;
    provinceCode?: string;
    province?: string;
    wardCode?: string;
    ward?: string;
    address?: string;
    lastActiveAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.fullName = user.fullName;
    dto.phone = user.phone;
    dto.email = user.email || user.account?.email;
    dto.dateOfBirth = user.dateOfBirth;
    dto.gender = user.gender;
    dto.avatarUrl = user.avatarUrl;
    dto.status = user.status;
    dto.CCCD = user.CCCD;
    dto.nationality = user.nationality;
    dto.nationalityName = user.nationality ? CountryEnum[user.nationality] : undefined;
    dto.ethnicity = user.ethnicity;
    dto.ethnicityName = user.ethnicity ? EthnicityEnum[user.ethnicity] : undefined;
    dto.occupation = user.occupation;
    dto.occupationName = user.occupation ? OccupationEnum[user.occupation] : undefined;
    dto.provinceCode = user.provinceCode;
    dto.province = user.province;
    dto.wardCode = user.wardCode;
    dto.ward = user.ward;
    dto.address = user.address;
    dto.lastActiveAt = user.lastActiveAt;
    dto.createdAt = user.createdAt;
    dto.updatedAt = user.updatedAt;
    return dto;
  }

  static fromNullable(
    user: Parameters<typeof UserResponseDto.fromEntity>[0] | null | undefined,
  ): UserResponseDto | null {
    return user ? UserResponseDto.fromEntity(user) : null;
  }
}

// ============================================================================
// PAGINATED RESPONSE DTO
// ============================================================================

import { PaginationMeta } from '@/common/dto/pagination.dto';

export class PaginatedUserResponseDto {
  @ApiProperty({
    type: [UserResponseDto],
    description: 'Danh sách users',
  })
  items: UserResponseDto[];

  @ApiProperty({
    description: 'Thông tin phân trang',
  })
  meta: PaginationMeta;
}
