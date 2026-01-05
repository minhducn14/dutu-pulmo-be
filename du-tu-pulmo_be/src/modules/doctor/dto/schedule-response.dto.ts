import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';

/**
 * Response DTO for DoctorSchedule entity
 */
export class DoctorScheduleResponseDto {
  @ApiProperty({
    example: 'b7c1cf97-6734-43ae-9a62-0f97b48f5123',
    description: 'ID lịch làm việc',
  })
  id: string;

  @ApiProperty({
    example: 'a7c1cf97-6734-43ae-9a62-0f97b48f5000',
    description: 'ID bác sĩ',
  })
  doctorId: string;

  @ApiProperty({
    example: 1,
    description: 'Ngày trong tuần (0=CN, 1=T2, ..., 6=T7)',
    minimum: 0,
    maximum: 6,
  })
  dayOfWeek: number;

  @ApiProperty({
    example: '09:00',
    description: 'Giờ bắt đầu làm việc',
  })
  startTime: string;

  @ApiProperty({
    example: '17:00',
    description: 'Giờ kết thúc làm việc',
  })
  endTime: string;

  @ApiProperty({
    example: 30,
    description: 'Thời gian mỗi slot (phút)',
  })
  slotDuration: number;

  @ApiProperty({
    example: 1,
    description: 'Số lượng bệnh nhân tối đa mỗi slot',
  })
  slotCapacity: number;

  @ApiProperty({
    enum: AppointmentTypeEnum,
    example: AppointmentTypeEnum.IN_CLINIC,
    description: 'Loại hình khám',
  })
  appointmentType: AppointmentTypeEnum;

  @ApiPropertyOptional({
    example: 'd7c1cf97-6734-43ae-9a62-0f97b48f5888',
    description: 'ID bệnh viện/phòng khám',
  })
  hospitalId?: string | null;

  @ApiProperty({
    example: 60,
    description: 'Thời gian đặt trước tối thiểu (phút)',
  })
  minimumBookingTime: number;

  @ApiProperty({
    example: 30,
    description: 'Số ngày tối đa được đặt trước',
  })
  maxAdvanceBookingDays: number;

  @ApiPropertyOptional({
    example: '500000',
    description: 'Phí khám riêng cho lịch này (VND). Nếu null sẽ dùng defaultConsultationFee của bác sĩ',
  })
  consultationFee?: string | null;

  @ApiPropertyOptional({
    example: '500000',
    description: 'Phí khám thực tế (VND) - fallback từ schedule hoặc doctor.defaultConsultationFee',
  })
  effectiveConsultationFee?: string | null;

  @ApiPropertyOptional({
    example: 'Khám ngoài giờ',
    description: 'Mô tả thêm về lịch làm việc',
  })
  description?: string | null;

  @ApiProperty({
    example: true,
    description: 'Trạng thái hoạt động',
  })
  isAvailable: boolean;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Ngày bắt đầu hiệu lực',
  })
  effectiveFrom?: Date | null;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Ngày kết thúc hiệu lực',
  })
  effectiveUntil?: Date | null;

  @ApiProperty({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Thời gian tạo',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Thời gian cập nhật',
  })
  updatedAt: Date;
}

/**
 * Response DTO for TimeSlot entity
 */
export class TimeSlotResponseDto {
  @ApiProperty({
    example: 'c7c1cf97-6734-43ae-9a62-0f97b48f5456',
    description: 'ID time slot',
  })
  id: string;

  @ApiProperty({
    example: 'a7c1cf97-6734-43ae-9a62-0f97b48f5000',
    description: 'ID bác sĩ',
  })
  doctorId: string;

  @ApiPropertyOptional({
    example: 'd7c1cf97-6734-43ae-9a62-0f97b48f5888',
    description: 'ID bệnh viện/phòng khám',
  })
  locationHospitalId?: string | null;

  @ApiProperty({
    type: [String],
    enum: AppointmentTypeEnum,
    example: [AppointmentTypeEnum.IN_CLINIC, AppointmentTypeEnum.VIDEO],
    description: 'Các loại hình khám được phép',
  })
  allowedAppointmentTypes: AppointmentTypeEnum[];

  @ApiProperty({
    example: '2026-01-10T09:00:00.000Z',
    description: 'Thời gian bắt đầu',
  })
  startTime: Date;

  @ApiProperty({
    example: '2026-01-10T09:30:00.000Z',
    description: 'Thời gian kết thúc',
  })
  endTime: Date;

  @ApiProperty({
    example: 1,
    description: 'Số lượng bệnh nhân tối đa',
  })
  capacity: number;

  @ApiProperty({
    example: 0,
    description: 'Số lượng đã đặt',
  })
  bookedCount: number;

  @ApiProperty({
    example: true,
    description: 'Còn trống hay không',
  })
  isAvailable: boolean;

  @ApiProperty({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Thời gian tạo',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-01-01T00:00:00.000Z',
    description: 'Thời gian cập nhật',
  })
  updatedAt: Date;
}
