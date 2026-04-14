import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class CompleteExaminationDto {
  @ApiProperty({
    description: 'Lý do khám',
    example: 'Ho kéo dài, đau tức ngực',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  chiefComplaint: string;

  @ApiPropertyOptional({
    description: 'Ghi chú khám lâm sàng (khám thực thể)',
    example: 'Họng đỏ, amidan sưng, có mủ trắng',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  physicalExamNotes?: string;

  @ApiProperty({
    description: 'Đánh giá chung của bác sĩ',
    example: 'Bệnh nhân bị viêm họng cấp do vi khuẩn',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  assessment: string;

  @ApiPropertyOptional({
    description: 'Chẩn đoán bệnh',
    example: 'Viêm họng cấp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosis?: string;

  @ApiProperty({
    description: 'Phác đồ điều trị',
    example:
      'Amoxicillin 500mg x 3 lần/ngày trong 7 ngày. Súc miệng nước muối sinh lý.',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(5000)
  treatmentPlan: string;

  @ApiPropertyOptional({
    description: 'Hướng dẫn tái khám',
    example: 'Uống thuốc đúng giờ, tránh đồ lạnh',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  followUpInstructions?: string;

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
