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
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Specialty } from 'src/modules/common/enums/specialty.enum';
import { DoctorTitle } from 'src/modules/common/enums/doctor-title.enum';

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
  @ApiPropertyOptional({ description: 'URL logo' })
  @IsOptional()
  @IsString()
  url?: string;

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
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1950)
  practiceStartYear?: number;

  @ApiPropertyOptional({
    description: 'Học hàm/học vị',
    enum: DoctorTitle,
    example: DoctorTitle.PHD_DOCTOR,
  })
  @IsOptional()
  @IsEnum(DoctorTitle)
  title?: DoctorTitle;

  @ApiPropertyOptional({ description: 'Chức vụ', example: 'Trưởng khoa' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  position?: string;

  @ApiPropertyOptional({ description: 'Giới thiệu bản thân' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({
    description: 'Chuyên khoa',
    enum: Specialty,
    example: Specialty.PULMONOLOGY,
  })
  @IsOptional()
  @IsEnum(Specialty)
  specialty?: Specialty;

  @ApiPropertyOptional({
    description: 'Ảnh giấy phép hành nghề',
    type: [LicenseImageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LicenseImageDto)
  licenseImageUrls?: LicenseImageDto[];

  @ApiPropertyOptional({ description: 'Số năm kinh nghiệm', example: 10 })
  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(0)
  yearsOfExperience?: number;

  @ApiPropertyOptional({
    description: 'ID bệnh viện công tác chính',
    example: 'uuid-hospital-id',
  })
  @IsOptional()
  @IsUUID()
  primaryHospitalId?: string;

  @ApiPropertyOptional({ description: 'Mô tả trình độ chuyên môn' })
  @IsOptional()
  @IsString()
  expertiseDescription?: string;

  @ApiPropertyOptional({ description: 'Kinh nghiệm làm việc' })
  @IsOptional()
  @IsString()
  workExperience?: string;

  @ApiPropertyOptional({ description: 'Học vấn' })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiPropertyOptional({
    description: 'Chứng chỉ',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        issuer: { type: 'string' },
        year: { type: 'number' },
      },
    },
    example: [{ name: 'Chứng chỉ Nội soi', issuer: 'BV Chợ Rẫy', year: 2020 }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CertificationDto)
  certifications?: CertificationDto[];

  @ApiPropertyOptional({ description: 'Giải thưởng/Công trình nghiên cứu' })
  @IsOptional()
  @IsString()
  awardsResearch?: string;

  @ApiPropertyOptional({
    description: 'Đơn vị đào tạo',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        name: { type: 'string' },
      },
    },
    example: [
      { url: 'https://example.com/logo.png', name: 'Đại học Y Hà Nội' },
    ],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrainingUnitDto)
  trainingUnits?: TrainingUnitDto[];

  @ApiPropertyOptional({
    description:
      'Phí khám mặc định (VND) - dùng khi schedule không set phí riêng',
    example: 300000,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000000)
  @Transform(({ value }) => (value != null ? value.toString() : null), {
    toClassOnly: true,
  })
  defaultConsultationFee?: string;
}
