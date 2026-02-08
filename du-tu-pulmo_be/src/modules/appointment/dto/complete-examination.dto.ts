import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class CompleteExaminationDto {
  @ApiPropertyOptional({
    description: 'Ghi chú khám lâm sàng (khám thực thể)',
    example: 'Họng đỏ, amidan sưng, có mủ trắng',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  physicalExamNotes?: string;

  @ApiPropertyOptional({
    description: 'Đánh giá chung của bác sĩ',
    example: 'Bệnh nhân bị viêm họng cấp do vi khuẩn',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  assessment?: string;

  @ApiPropertyOptional({
    description: 'Chẩn đoán bệnh',
    example: 'Viêm họng cấp (J02.9)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosisNotes?: string;

  @ApiPropertyOptional({
    description: 'Phác đồ điều trị',
    example:
      'Amoxicillin 500mg x 3 lần/ngày trong 7 ngày. Súc miệng nước muối sinh lý.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  treatmentPlan?: string;

  @ApiPropertyOptional({
    description: 'Có cần tái khám không',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Ngày tái khám (nếu cần)',
    example: '2024-02-15T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  nextAppointmentDate?: string;
}
