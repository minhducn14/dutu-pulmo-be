import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, Matches } from 'class-validator';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';

// ============================================
// Preview Flexible Schedule Conflicts
// ============================================

export class PreviewFlexibleScheduleConflictsDto {
  @ApiProperty({
    description: 'Ngày cụ thể (YYYY-MM-DD)',
    example: '2026-01-15',
  })
  @IsNotEmpty()
  @IsDateString()
  specificDate: string;

  @ApiProperty({
    description: 'Giờ bắt đầu (HH:mm)',
    example: '09:00',
  })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({
    description: 'Giờ kết thúc (HH:mm)',
    example: '17:00',
  })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;
}

// ============================================
// Preview Time Off Conflicts
// ============================================

export class PreviewTimeOffConflictsDto {
  @ApiProperty({
    description: 'Ngày nghỉ (YYYY-MM-DD)',
    example: '2026-01-20',
  })
  @IsNotEmpty()
  @IsDateString()
  specificDate: string;

  @ApiProperty({
    description: 'Giờ bắt đầu nghỉ (HH:mm)',
    example: '08:00',
  })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime must be in HH:mm format',
  })
  startTime: string;

  @ApiProperty({
    description: 'Giờ kết thúc nghỉ (HH:mm)',
    example: '12:00',
  })
  @IsNotEmpty()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime must be in HH:mm format',
  })
  endTime: string;
}

// ============================================
// Response DTOs
// ============================================

export class ConflictingAppointmentDto {
  @ApiProperty({ description: 'ID cuộc hẹn' })
  id: string;

  @ApiProperty({ description: 'Mã cuộc hẹn' })
  appointmentNumber: string;

  @ApiProperty({ description: 'Tên bệnh nhân' })
  patientName: string;

  @ApiProperty({ description: 'Thời gian đã đặt' })
  scheduledAt: Date;

  @ApiProperty({ description: 'Thời lượng (phút)' })
  durationMinutes: number;

  @ApiProperty({ description: 'Loại cuộc hẹn', enum: AppointmentTypeEnum })
  appointmentType: AppointmentTypeEnum;

  @ApiProperty({ description: 'Trạng thái hiện tại' })
  status: string;
}

export class PreviewConflictsResponseDto {
  @ApiProperty({
    description: 'Danh sách cuộc hẹn sẽ bị hủy',
    type: [ConflictingAppointmentDto],
  })
  conflictingAppointments: ConflictingAppointmentDto[];

  @ApiProperty({ description: 'Số lượng time slots bị ảnh hưởng' })
  affectedSlotsCount: number;

  @ApiProperty({ description: 'Thông báo tổng kết' })
  message: string;
}
