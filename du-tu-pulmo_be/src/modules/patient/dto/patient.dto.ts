import { IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';

/**
 * DTO for query patients with pagination and filtering
 */
export class PatientQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo nhóm máu',
    example: 'A+',
  })
  @IsOptional()
  @IsString()
  bloodType?: string;
}

/**
 * DTO for updating patient information
 */
export class UpdatePatientDto {
  @ApiPropertyOptional({ description: 'Nhóm máu' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  bloodType?: string;

  @ApiPropertyOptional({ description: 'Tên liên hệ khẩn cấp' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactName?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ khẩn cấp' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    description: 'Mối quan hệ với người liên hệ khẩn cấp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emergencyContactRelationship?: string;

  @ApiPropertyOptional({ description: 'Nhà cung cấp bảo hiểm' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  insuranceProvider?: string;

  @ApiPropertyOptional({ description: 'Số bảo hiểm' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  insuranceNumber?: string;

  @ApiPropertyOptional({ description: 'Ngày hết hạn bảo hiểm' })
  @IsOptional()
  @IsDateString()
  insuranceExpiry?: string;
}
