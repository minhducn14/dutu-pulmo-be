import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatusEnum } from '../../common/enums/user-status.enum';
import { GenderEnum } from '../../common/enums/gender.enum';

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
}
