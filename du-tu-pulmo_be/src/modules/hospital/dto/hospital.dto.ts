import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  IsNumber,
  Min,
  Max,
  Matches,
  IsEnum,
} from 'class-validator';
import { FacilityTypeEnum } from 'src/modules/common/enums/facility-type.enum';

export class CreateHospitalDto {
  @ApiProperty({ example: 'Bệnh viện Đa khoa Tâm Anh' })
  @IsString()
  @IsNotEmpty({ message: 'Tên bệnh viện không được để trống' })
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 'BVTA-001' })
  @IsString()
  @IsNotEmpty({ message: 'Mã bệnh viện không được để trống' })
  @MaxLength(50)
  @Matches(/^[A-Z0-9-]+$/, {
    message: 'Mã bệnh viện chỉ chứa chữ hoa, số và dấu gạch ngang',
  })
  hospitalCode: string;

  @ApiProperty({ example: '0281234567' })
  @IsString()
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @MaxLength(20)
  @Matches(/^[0-9+\-\s()]+$/, { message: 'Số điện thoại không hợp lệ' })
  phone: string;

  @ApiProperty({ example: 'contact@tamanh.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(100)
  email?: string;

  @ApiProperty({
    example: FacilityTypeEnum.HOSPITAL,
    enum: FacilityTypeEnum,
    required: false,
    default: FacilityTypeEnum.HOSPITAL,
    description: 'Loại cơ sở y tế (hospital hoặc clinic)',
  })
  @IsOptional()
  @IsEnum(FacilityTypeEnum, { message: 'Loại cơ sở y tế không hợp lệ' })
  facilityType?: FacilityTypeEnum;

  @ApiProperty({
    example: 'https://example.com/logo.png',
    required: false,
    description: 'URL logo của bệnh viện',
  })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  // ===== ĐỊA CHỈ =====
  @ApiProperty({ example: '01', required: false, description: 'Mã tỉnh/thành phố' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  provinceCode?: string;

  @ApiProperty({ example: 'Hà Nội', required: false, description: 'Tỉnh/Thành phố' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiProperty({ example: '00001', required: false, description: 'Mã phường/xã' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  wardCode?: string;

  @ApiProperty({ example: 'Phường Bồ Đề', required: false, description: 'Phường/Xã' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ward?: string;

  @ApiProperty({ example: '108 Hoàng Như Tiếp', required: false, description: 'Địa chỉ chi tiết (số nhà, đường)' })
  @IsOptional()
  @IsString()
  address?: string;

  // ===== TỌA ĐỘ =====
  @ApiProperty({ example: 21.0542, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Vĩ độ phải là số' })
  @Min(-90, { message: 'Vĩ độ phải từ -90 đến 90' })
  @Max(90, { message: 'Vĩ độ phải từ -90 đến 90' })
  latitude?: number;

  @ApiProperty({ example: 105.8516, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Kinh độ phải là số' })
  @Min(-180, { message: 'Kinh độ phải từ -180 đến 180' })
  @Max(180, { message: 'Kinh độ phải từ -180 đến 180' })
  longitude?: number;
}

export class UpdateHospitalDto extends PartialType(CreateHospitalDto) {}

export class HospitalQueryDto {
  @ApiProperty({ required: false, example: 'Tâm Anh', description: 'Tìm kiếm theo tên, mã, địa chỉ, tỉnh/thành phố, phường/xã' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    required: false,
    example: FacilityTypeEnum.HOSPITAL,
    enum: FacilityTypeEnum,
    description: 'Lọc theo loại cơ sở y tế',
  })
  @IsOptional()
  @IsEnum(FacilityTypeEnum)
  facilityType?: FacilityTypeEnum;

  @ApiProperty({ required: false, example: '01', description: 'Lọc theo mã tỉnh/thành phố' })
  @IsOptional()
  @IsString()
  provinceCode?: string;

  @ApiProperty({ required: false, example: 'Hà Nội', description: 'Lọc theo tên tỉnh/thành phố' })
  @IsOptional()
  @IsString()
  province?: string;

  @ApiProperty({ required: false, example: '00001', description: 'Lọc theo mã phường/xã' })
  @IsOptional()
  @IsString()
  wardCode?: string;

  @ApiProperty({ required: false, example: 'Phường Bồ Đề', description: 'Lọc theo tên phường/xã' })
  @IsOptional()
  @IsString()
  ward?: string;

  @ApiProperty({ required: false, example: 1, default: 1 })
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false, example: 20, default: 20 })
  @IsOptional()
  limit?: number;
}
