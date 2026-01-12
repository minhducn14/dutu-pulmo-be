import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatusEnum } from '../../common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '../../common/enums/appointment-type.enum';
import { AppointmentSubTypeEnum } from '../../common/enums/appointment-sub-type.enum';
import { SourceTypeEnum } from '../../common/enums/source-type.enum';

export class AppointmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  appointmentNumber: string;

  @ApiProperty()
  patientId: string;

  @ApiProperty()
  doctorId: string;

  @ApiPropertyOptional()
  hospitalId?: string;

  @ApiPropertyOptional()
  timeSlotId?: string;

  @ApiProperty()
  scheduledAt: Date;

  @ApiProperty()
  durationMinutes: number;

  @ApiProperty()
  timezone: string;

  @ApiProperty({ enum: AppointmentStatusEnum })
  status: AppointmentStatusEnum;

  @ApiProperty({ enum: AppointmentTypeEnum })
  appointmentType: AppointmentTypeEnum;

  @ApiProperty({ enum: AppointmentSubTypeEnum })
  subType: AppointmentSubTypeEnum;

  @ApiProperty({ enum: SourceTypeEnum })
  sourceType: SourceTypeEnum;

  @ApiProperty()
  feeAmount: string;

  @ApiProperty()
  paidAmount: string;

  @ApiPropertyOptional()
  paymentId?: string;

  @ApiProperty()
  refunded: boolean;

  @ApiPropertyOptional()
  meetingRoomId?: string;

  @ApiPropertyOptional()
  meetingUrl?: string;

  @ApiPropertyOptional()
  dailyCoChannel?: string;

  // @ApiPropertyOptional()
  // roomNumber?: string;

  @ApiPropertyOptional()
  queueNumber?: number;

  // @ApiPropertyOptional()
  // floor?: string;

  @ApiPropertyOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional()
  symptoms?: string[];

  @ApiPropertyOptional()
  patientNotes?: string;

  @ApiPropertyOptional()
  doctorNotes?: string;

  @ApiPropertyOptional()
  checkInTime?: Date;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  endedAt?: Date;

  @ApiPropertyOptional()
  cancelledAt?: Date;

  @ApiPropertyOptional()
  cancellationReason?: string;

  @ApiPropertyOptional()
  cancelledBy?: string;

  @ApiProperty()
  followUpRequired: boolean;

  @ApiPropertyOptional()
  nextAppointmentDate?: Date;

  @ApiPropertyOptional()
  patientRating?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================================================
// NEW: STATISTICS DTO
// ============================================================================

export class AppointmentStatisticsDto {
  @ApiProperty({ description: 'Tổng số lịch hẹn' })
  totalAppointments: number;

  @ApiProperty({ description: 'Số lịch đã hoàn thành' })
  completedCount: number;

  @ApiProperty({ description: 'Số lịch đã hủy' })
  cancelledCount: number;

  @ApiPropertyOptional({ description: 'Số lịch đang chờ' })
  pendingCount?: number;

  @ApiPropertyOptional({ description: 'Số lịch đã xác nhận' })
  confirmedCount?: number;

  @ApiPropertyOptional({ description: 'Số lịch đang khám' })
  inProgressCount?: number;

  @ApiProperty({ description: 'Số lịch sắp tới' })
  upcomingCount: number;

  @ApiPropertyOptional({ description: 'Số lịch hôm nay' })
  todayCount?: number;

  @ApiProperty({ 
    type: [AppointmentResponseDto],
    description: 'Danh sách lịch hẹn sắp tới (tối đa 10)' 
  })
  upcomingAppointments: AppointmentResponseDto[];
}

// ============================================================================
// NEW: QUEUE DTO
// ============================================================================

export class DoctorQueueDto {
  @ApiProperty({ description: 'Doctor ID' })
  doctorId: string;

  @ApiProperty({ description: 'Tổng số trong hàng đợi' })
  totalInQueue: number;

  @ApiProperty({ 
    type: [AppointmentResponseDto],
    description: 'Lịch đang khám (IN_PROGRESS)' 
  })
  inProgress: AppointmentResponseDto[];

  @ApiProperty({ 
    type: [AppointmentResponseDto],
    description: 'Hàng đợi đã check-in (CHECKED_IN)' 
  })
  waitingQueue: AppointmentResponseDto[];

  @ApiProperty({ 
    type: [AppointmentResponseDto],
    description: 'Lịch hẹn sắp tới hôm nay (CONFIRMED)' 
  })
  upcomingToday: AppointmentResponseDto[];

  @ApiPropertyOptional({ 
    type: AppointmentResponseDto,
    description: 'Bệnh nhân đang khám hiện tại' 
  })
  currentPatient: AppointmentResponseDto | null;

  @ApiPropertyOptional({ 
    type: AppointmentResponseDto,
    description: 'Bệnh nhân tiếp theo trong hàng đợi' 
  })
  nextPatient: AppointmentResponseDto | null;
}

// ============================================================================
// PAGINATED RESPONSE DTO
// ============================================================================

import { PaginationMeta } from 'src/common/dto/pagination.dto';

export class PaginatedAppointmentResponseDto {
  @ApiProperty({ 
    type: [AppointmentResponseDto],
    description: 'Danh sách lịch hẹn' 
  })
  items: AppointmentResponseDto[];

  @ApiProperty({ 
    description: 'Thông tin phân trang' 
  })
  meta: PaginationMeta;
}
