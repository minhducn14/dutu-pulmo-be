import { ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsOptional, 
  IsString, 
  Length, 
  IsEnum, 
  IsDateString,
  Matches,
} from 'class-validator';
import { UserStatusEnum } from '../../common/enums/user-status.enum';
import { GenderEnum } from '../../common/enums/gender.enum';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Tên đầy đủ của người dùng',
    example: 'Nguyễn Văn A',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'Họ tên phải là chuỗi' })
  @Length(2, 100, { message: 'Họ tên phải từ 2 đến 100 ký tự' })
  fullName?: string;

  @ApiPropertyOptional({
    description: 'Số điện thoại người dùng (Việt Nam)',
    example: '0912345678',
    maxLength: 20,
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi' })
  @Matches(/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/, {
    message: 'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam',
  })
  phone?: string;

  @ApiPropertyOptional({
    description: 'Ngày sinh (YYYY-MM-DD)',
    example: '1990-01-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Ngày sinh không đúng định dạng (YYYY-MM-DD)' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    description: 'Giới tính',
    enum: GenderEnum,
    example: GenderEnum.MALE,
  })
  @IsOptional()
  @IsEnum(GenderEnum, { message: 'Giới tính không hợp lệ' })
  gender?: GenderEnum;

  @ApiPropertyOptional({
    description: 'Số CCCD của người dùng',
    example: '079123456789',
  })
  @IsOptional()
  @IsString({ message: 'CCCD phải là chuỗi' })
  @Length(12, 12, { message: 'CCCD phải có đúng 12 số' })
  @Matches(/^[0-9]{12}$/, { message: 'CCCD phải là 12 chữ số' })
  CCCD?: string;

  // Địa chỉ
  @ApiPropertyOptional({
    description: 'Mã Tỉnh/Thành phố',
    example: '01',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  provinceCode?: string;

  @ApiPropertyOptional({
    description: 'Tỉnh/Thành phố',
    example: 'Hồ Chí Minh',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  province?: string;

  @ApiPropertyOptional({
    description: 'Mã Phường/Xã',
    example: '00001',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  wardCode?: string;

  @ApiPropertyOptional({
    description: 'Phường/Xã',
    example: 'Phường Bến Nghé',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  ward?: string;

  @ApiPropertyOptional({
    description: 'Địa chỉ chi tiết',
    example: '123 Đường Nguyễn Huệ',
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({
    description: 'Trạng thái tài khoản (chỉ admin mới có thể cập nhật)',
    enum: UserStatusEnum,
    example: UserStatusEnum.ACTIVE,
  })
  @IsOptional()
  @IsEnum(UserStatusEnum, { message: 'Trạng thái không hợp lệ' })
  status?: UserStatusEnum;
}
