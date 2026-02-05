import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for a single prescription item
 */
export class CreatePrescriptionItemDto {
  @ApiPropertyOptional({ description: 'Medicine ID từ danh mục (nếu có)' })
  @IsOptional()
  @IsUUID()
  medicineId?: string;

  @ApiProperty({
    description: 'Tên thuốc (bắt buộc - snapshot tại thời điểm kê)',
  })
  @IsString()
  @MaxLength(255)
  medicineName: string;

  @ApiProperty({ description: 'Liều dùng', example: '500mg' })
  @IsString()
  @MaxLength(100)
  dosage: string;

  @ApiProperty({ description: 'Tần suất', example: '3 lần/ngày' })
  @IsString()
  @MaxLength(100)
  frequency: string;

  @ApiProperty({ description: 'Thời gian dùng', example: '7 ngày' })
  @IsString()
  @MaxLength(100)
  duration: string;

  @ApiPropertyOptional({ description: 'Đơn vị', example: 'viên' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ description: 'Số lượng', example: 21 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Hướng dẫn sử dụng' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  instructions?: string;
}
