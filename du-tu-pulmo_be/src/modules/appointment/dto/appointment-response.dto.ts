import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from 'src/modules/common/enums/appointment-status.enum';

/**
 * Response DTO for appointment data
 */
export class AppointmentResponseDto {
  @ApiProperty({ description: 'ID lịch hẹn', format: 'uuid' })
  id: string;

  @ApiProperty({ description: 'Mã lịch hẹn', example: 'APT-ABC123-XYZ9' })
  appointmentNumber: string;

  @ApiProperty({ description: 'ID bệnh nhân', format: 'uuid' })
  patientId: string;

  @ApiPropertyOptional({ description: 'ID bác sĩ', format: 'uuid' })
  doctorId?: string;

  @ApiPropertyOptional({ description: 'ID bệnh viện', format: 'uuid' })
  hospitalId?: string;

  @ApiPropertyOptional({ description: 'ID khung giờ', format: 'uuid' })
  timeSlotId?: string;

  @ApiProperty({
    description: 'Loại hình khám',
    enum: AppointmentTypeEnum,
    example: AppointmentTypeEnum.IN_CLINIC,
  })
  appointmentType: AppointmentTypeEnum;

  @ApiProperty({ description: 'Thời gian hẹn' })
  scheduledAt: Date;

  @ApiProperty({ description: 'Thời lượng khám (phút)', example: 30 })
  durationMinutes: number;

  @ApiProperty({ description: 'Múi giờ', example: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @ApiProperty({
    description: 'Trạng thái',
    enum: AppointmentStatusEnum,
    example: AppointmentStatusEnum.PENDING_PAYMENT,
  })
  status: AppointmentStatusEnum;

  @ApiProperty({ description: 'Phí khám', example: '200000' })
  feeAmount: string;

  @ApiProperty({ description: 'Số tiền đã thanh toán', example: '0' })
  paidAmount: string;

  @ApiPropertyOptional({ description: 'ID thanh toán', format: 'uuid' })
  paymentId?: string;

  @ApiProperty({ description: 'Đã hoàn tiền', example: false })
  refunded: boolean;

  // Video call fields
  @ApiPropertyOptional({ description: 'ID phòng họp' })
  meetingRoomId?: string;

  @ApiPropertyOptional({ description: 'URL phòng họp' })
  meetingUrl?: string;

  // Clinical info
  @ApiPropertyOptional({ description: 'Lý do khám chính' })
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Triệu chứng', type: [String] })
  symptoms?: string[];

  @ApiPropertyOptional({ description: 'Ghi chú của bệnh nhân' })
  patientNotes?: string;

  @ApiPropertyOptional({ description: 'Ghi chú của bác sĩ' })
  doctorNotes?: string;

  // Timeline
  @ApiPropertyOptional({ description: 'Thời gian check-in' })
  checkInTime?: Date;

  @ApiPropertyOptional({ description: 'Thời gian bắt đầu khám' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc khám' })
  endedAt?: Date;

  // Cancellation
  @ApiPropertyOptional({ description: 'Thời gian hủy' })
  cancelledAt?: Date;

  @ApiPropertyOptional({ description: 'Lý do hủy' })
  cancellationReason?: string;

  @ApiPropertyOptional({
    description: 'Người hủy (PATIENT/DOCTOR/ADMIN/SYSTEM)',
  })
  cancelledBy?: string;

  // Follow-up
  @ApiProperty({ description: 'Cần tái khám', example: false })
  followUpRequired: boolean;

  @ApiPropertyOptional({ description: 'Ngày tái khám' })
  nextAppointmentDate?: Date;

  // Rating
  @ApiPropertyOptional({ description: 'Đánh giá của bệnh nhân (1-5)' })
  patientRating?: number;

  @ApiProperty({ description: 'Thời gian tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Thời gian cập nhật' })
  updatedAt: Date;
}
