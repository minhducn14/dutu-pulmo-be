import {
  IsOptional,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for creating vital signs via appointment endpoint
 */
export class CreateVitalSignDto {
  @ApiPropertyOptional({ description: 'Nhiệt độ (°C)', example: 36.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Nhiệt độ chỉ được phép có tối đa 2 số thập phân' },
  )
  @Min(30)
  @Max(45)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Huyết áp (mmHg)', example: '120/80' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bloodPressure?: string;

  @ApiPropertyOptional({ description: 'Nhịp tim (bpm)', example: 75 })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(250)
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Nhịp thở (lần/phút)', example: 16 })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'SpO2 (%)', example: 98 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  spo2?: number;

  @ApiPropertyOptional({ description: 'Chiều cao (cm)', example: 170 })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(250)
  height?: number;

  @ApiPropertyOptional({ description: 'Cân nặng (kg)', example: 65 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  weight?: number;

  @ApiPropertyOptional({ description: 'Ghi chú' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
