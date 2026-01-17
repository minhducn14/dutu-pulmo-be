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
import { AppointmentStatusEnum } from '../../common/enums/appointment-status.enum';

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
    description: 'Ghi chú của bác sĩ về buổi khám',
    example: 'Bệnh nhân bị viêm họng cấp, đã kê đơn thuốc kháng sinh',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  doctorNotes?: string;

  @ApiPropertyOptional({
    description:
      'Ghi chú lâm sàng chi tiết (chẩn đoán, kết quả xét nghiệm, đơn thuốc)',
    example:
      'Chẩn đoán: Viêm họng cấp\nĐơn thuốc: Amoxicillin 500mg x 3 lần/ngày',
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  clinicalNotes?: string;

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
