import { ApiProperty, PartialType, ApiPropertyOptional } from '@nestjs/swagger';
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
} from 'class-validator';

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

  @ApiPropertyOptional({ example: 'contact@tamanh.com', required: false })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(100)
  email?: string;

  @ApiProperty({ example: '108 Hoàng Như Tiếp, Phường Bồ Đề' })
  @IsString()
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  address: string;

  @ApiProperty({ example: 'Quận Long Biên' })
  @IsString()
  @IsNotEmpty({ message: 'Quận/Huyện không được để trống' })
  @MaxLength(100)
  ward: string;

  @ApiProperty({ example: 'Hà Nội' })
  @IsString()
  @IsNotEmpty({ message: 'Thành phố không được để trống' })
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'Hà Nội' })
  @IsString()
  @IsNotEmpty({ message: 'Tỉnh/Thành phố không được để trống' })
  @MaxLength(100)
  province: string;

  @ApiPropertyOptional({ example: 21.0542, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Vĩ độ phải là số' })
  @Min(-90, { message: 'Vĩ độ phải từ -90 đến 90' })
  @Max(90, { message: 'Vĩ độ phải từ -90 đến 90' })
  latitude?: number;

  @ApiPropertyOptional({ example: 105.8516, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Kinh độ phải là số' })
  @Min(-180, { message: 'Kinh độ phải từ -180 đến 180' })
  @Max(180, { message: 'Kinh độ phải từ -180 đến 180' })
  longitude?: number;
}

export class UpdateHospitalDto extends PartialType(CreateHospitalDto) {}

export class HospitalQueryDto {
  @ApiPropertyOptional({ required: false, example: 'Tâm Anh' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ required: false, example: 'Hà Nội' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ required: false, example: 1, default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ required: false, example: 20, default: 20 })
  @IsOptional()
  limit?: number;
}
