import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { AppointmentSubTypeEnum } from '@/modules/common/enums/appointment-sub-type.enum';
import { SourceTypeEnum } from '@/modules/common/enums/source-type.enum';
import { PaginationMeta } from '@/common/dto/pagination.dto';
import { DoctorResponseDto } from '@/modules/doctor/dto/doctor-response.dto';
import { PatientResponseDto } from '@/modules/patient/dto/patient-response.dto';
import type { Appointment } from '@/modules/appointment/entities/appointment.entity';

export class AppointmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  appointmentNumber: string;

  @ApiProperty()
  patient: PatientResponseDto;

  @ApiProperty()
  doctor: DoctorResponseDto;

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

  static fromEntity(entity: Appointment): AppointmentResponseDto {
    const dto = new AppointmentResponseDto();
    dto.id = entity.id;
    dto.appointmentNumber = entity.appointmentNumber;
    dto.patient = entity.patient
      ? PatientResponseDto.fromEntity(entity.patient)
      : (null as unknown as PatientResponseDto);
    dto.doctor = entity.doctor
      ? DoctorResponseDto.fromEntity(entity.doctor)
      : (null as unknown as DoctorResponseDto);
    dto.hospitalId = entity.hospitalId || undefined;
    dto.timeSlotId = entity.timeSlotId || undefined;
    dto.scheduledAt = entity.scheduledAt;
    dto.durationMinutes = entity.durationMinutes;
    dto.timezone = entity.timezone;
    dto.status = entity.status;
    dto.appointmentType = entity.appointmentType;
    dto.subType = entity.subType;
    dto.sourceType = entity.sourceType;
    dto.feeAmount = entity.feeAmount;
    dto.paidAmount = entity.paidAmount;
    dto.paymentId = entity.paymentId || undefined;
    dto.refunded = entity.refunded;
    dto.meetingRoomId = entity.meetingRoomId || undefined;
    dto.meetingUrl = entity.meetingUrl || undefined;
    dto.dailyCoChannel = entity.dailyCoChannel || undefined;
    dto.queueNumber = entity.queueNumber || undefined;
    dto.chiefComplaint = entity.chiefComplaint || undefined;
    dto.symptoms = entity.symptoms || undefined;
    dto.patientNotes = entity.patientNotes || undefined;
    dto.doctorNotes = entity.doctorNotes || undefined;
    dto.checkInTime = entity.checkInTime || undefined;
    dto.startedAt = entity.startedAt || undefined;
    dto.endedAt = entity.endedAt || undefined;
    dto.cancelledAt = entity.cancelledAt || undefined;
    dto.cancellationReason = entity.cancellationReason || undefined;
    dto.cancelledBy = entity.cancelledBy || undefined;
    dto.followUpRequired = entity.followUpRequired;
    dto.nextAppointmentDate = entity.nextAppointmentDate || undefined;
    dto.patientRating = entity.patientRating || undefined;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromData(data: AppointmentResponseDto): AppointmentResponseDto {
    return Object.assign(new AppointmentResponseDto(), data);
  }

  static mapList(
    items: AppointmentResponseDto[] | undefined,
  ): AppointmentResponseDto[] {
    return (items ?? []).map((item) => AppointmentResponseDto.fromData(item));
  }
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
    description: 'Danh sách lịch hẹn sắp tới (tối đa 10)',
  })
  upcomingAppointments: AppointmentResponseDto[];
}

// ============================================================================
// NEW: QUEUE DTO
// ============================================================================

export class DoctorQueueDto {
  @ApiPropertyOptional({
    description: 'Doctor (null if no appointments today)',
  })
  doctor: DoctorResponseDto | null;

  @ApiPropertyOptional({
    description: 'First patient in queue (null if no appointments today)',
  })
  patient: PatientResponseDto | null;

  @ApiProperty({ description: 'Tổng số trong hàng đợi' })
  totalInQueue: number;

  @ApiProperty({
    type: [AppointmentResponseDto],
    description: 'Lịch đang khám (IN_PROGRESS)',
  })
  inProgress: AppointmentResponseDto[];

  @ApiProperty({
    type: [AppointmentResponseDto],
    description: 'Hàng đợi đã check-in (CHECKED_IN)',
  })
  waitingQueue: AppointmentResponseDto[];

  @ApiProperty({
    type: [AppointmentResponseDto],
    description: 'Lịch hẹn sắp tới hôm nay (CONFIRMED)',
  })
  upcomingToday: AppointmentResponseDto[];

  @ApiPropertyOptional({
    type: AppointmentResponseDto,
    description: 'Bệnh nhân đang khám hiện tại',
  })
  currentPatient: AppointmentResponseDto | null;

  @ApiPropertyOptional({
    type: AppointmentResponseDto,
    description: 'Bệnh nhân tiếp theo trong hàng đợi',
  })
  nextPatient: AppointmentResponseDto | null;
}

// ============================================================================
// PAGINATED RESPONSE DTO
// ============================================================================

export class PaginatedAppointmentResponseDto {
  @ApiProperty({
    type: [AppointmentResponseDto],
    description: 'Danh sách lịch hẹn',
  })
  items: AppointmentResponseDto[];

  @ApiProperty({
    description: 'Thông tin phân trang',
  })
  meta: PaginationMeta;

  static fromResult(
    data?: PaginatedAppointmentResponseDto,
  ): PaginatedAppointmentResponseDto {
    return {
      items: AppointmentResponseDto.mapList(data?.items),
      meta: data?.meta as PaginationMeta,
    };
  }
}
