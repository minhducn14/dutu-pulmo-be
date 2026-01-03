import {
  IsString,
  IsOptional,
  IsInt,
  IsUUID,
  IsArray,
  ValidateNested,
  Min,
  Max,
  Length,
  IsNotEmpty,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class LicenseImageDto {
  @ApiProperty({ description: 'URL ảnh giấy phép hành nghề' })
  @IsString()
  url: string;

  @ApiPropertyOptional({ description: 'Ngày hết hạn (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  expiry?: string;
}

class CertificationDto {
  @ApiProperty({ description: 'Tên chứng chỉ' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Đơn vị cấp' })
  @IsString()
  issuer: string;

  @ApiProperty({ description: 'Năm cấp' })
  @IsInt()
  year: number;
}

class TrainingUnitDto {
  @ApiProperty({ description: 'URL logo đơn vị đào tạo' })
  @IsString()
  url: string;

  @ApiProperty({ description: 'Tên đơn vị đào tạo' })
  @IsString()
  name: string;
}

export class CreateDoctorDto {
  // ========== Thông tin đăng ký tài khoản ==========
  @IsEmail()
  @ApiProperty({ example: 'doctor@email.com', description: 'Email đăng ký' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu tối đa 128 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
  })
  @ApiProperty({
    example: 'SecurePass123',
    minLength: 8,
    description: 'Mật khẩu (ít nhất 8 ký tự, có chữ hoa, chữ thường và số)',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @ApiProperty({
    example: 'BS. Nguyễn Văn A',
    description: 'Tên đầy đủ của bác sĩ',
  })
  fullName: string;

  @IsOptional()
  @IsString()
  @Matches(/^0[1-9]\d{8}$/, {
    message: 'Số điện thoại không hợp lệ (VD: 0912345678)',
  })
  @ApiPropertyOptional({ example: '0912345678', description: 'Số điện thoại' })
  phone?: string;

  // ========== Thông tin bác sĩ ==========

  @ApiProperty({ description: 'Số giấy phép hành nghề', example: 'GP-12345' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  licenseNumber: string;

  @ApiPropertyOptional({ description: 'Năm bắt đầu hành nghề', example: 2010 })
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsInt()
  @Min(1950)
  practiceStartYear?: number;

  @ApiPropertyOptional({ description: 'Học hàm/học vị', example: 'Tiến sĩ' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  title?: string;

  @ApiPropertyOptional({ description: 'Chức vụ', example: 'Trưởng khoa' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  position?: string;

  @ApiPropertyOptional({ description: 'ID chuyên khoa (UUID)' })
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @ApiPropertyOptional({
    description: 'Danh sách ID chuyên khám (SubSpecialty IDs)',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  subSpecialtyIds?: string[];

  @ApiPropertyOptional({ description: 'Số năm kinh nghiệm', example: 15 })
  @IsOptional()
  @Transform(({ value }) => value ? parseInt(value, 10) : undefined)
  @IsInt()
  @Min(0)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ description: 'ID bệnh viện chính (UUID)' })
  @IsOptional()
  @IsUUID()
  primaryHospitalId?: string;

  @ApiPropertyOptional({ description: 'Mô tả trình độ chuyên môn' })
  @IsOptional()
  @IsString()
  expertiseDescription?: string;

  @ApiPropertyOptional({ description: 'Giới thiệu bản thân' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Kinh nghiệm làm việc' })
  @IsOptional()
  @IsString()
  workExperience?: string;

  @ApiPropertyOptional({ description: 'Học vấn' })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiPropertyOptional({ description: 'Giải thưởng/Công trình nghiên cứu' })
  @IsOptional()
  @IsString()
  awardsResearch?: string;

  @ApiPropertyOptional({
    description: 'Ảnh giấy phép hành nghề',
    type: [LicenseImageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LicenseImageDto)
  licenseImageUrls?: LicenseImageDto[];

  @ApiPropertyOptional({
    description: 'Chứng chỉ',
    type: [CertificationDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications?: CertificationDto[];

  @ApiPropertyOptional({
    description: 'Đơn vị đào tạo',
    type: [TrainingUnitDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrainingUnitDto)
  trainingUnits?: TrainingUnitDto[];
}
