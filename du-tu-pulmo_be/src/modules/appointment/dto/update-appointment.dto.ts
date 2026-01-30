import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';

// ============================================================================
// EXISTING DTOs
// ============================================================================

export class UpdateStatusDto {
  @ApiProperty({
    enum: AppointmentStatusEnum,
    description: 'Trạng thái mới của lịch hẹn',
  })
  @IsEnum(AppointmentStatusEnum)
  status: AppointmentStatusEnum;
}

export class CancelAppointmentDto {
  @ApiProperty({ description: 'Lý do hủy lịch' })
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class RescheduleAppointmentDto {
  @ApiProperty({ description: 'ID của time slot mới' })
  @IsUUID()
  newTimeSlotId: string;
}

// ============================================================================
// NEW: COMPLETE EXAMINATION DTO
// ============================================================================

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
