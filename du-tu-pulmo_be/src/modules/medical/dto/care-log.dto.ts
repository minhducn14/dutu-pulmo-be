import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  Max,
  IsDateString,
  Matches,
} from 'class-validator';

export class CreateCareLogDto {
  @ApiProperty({ description: 'Ngày tạo (YYYY-MM-DD)', example: '2026-01-20' })
  @IsDateString()
  logDate: string;

  @ApiProperty({ description: 'Giờ tạo (HH:mm)', example: '14:30' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:mm format',
  })
  logTime: string;

  @ApiPropertyOptional({ description: 'Cân nặng (kg)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  weight?: number;

  @ApiPropertyOptional({ description: 'Nhiệt độ (°C)' })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(45)
  temperature?: number;

  @ApiPropertyOptional({ description: 'Huyết áp (mmHg)', example: '120/80' })
  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @ApiPropertyOptional({ description: 'Mạch (lần/phút)' })
  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(250)
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Nhịp thở (lần/phút)' })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'SpO2 (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  spo2?: number;

  @ApiPropertyOptional({ description: 'Chiều cao (cm)' })
  @IsOptional()
  @IsNumber()
  @Min(50)
  @Max(250)
  height?: number;
}

export class CareLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  medicalRecordId: string;

  @ApiProperty()
  logDate: Date;

  @ApiProperty()
  logTime: string;

  @ApiPropertyOptional()
  weight?: number;

  @ApiPropertyOptional()
  temperature?: number;

  @ApiPropertyOptional()
  bloodPressure?: string;

  @ApiPropertyOptional()
  heartRate?: number;

  @ApiPropertyOptional()
  respiratoryRate?: number;

  @ApiPropertyOptional()
  spo2?: number;

  @ApiPropertyOptional()
  height?: number;

  @ApiPropertyOptional()
  bmi?: number;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty()
  createdAt: Date;
}
