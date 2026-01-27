import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { ScheduleType } from 'src/modules/common/enums/schedule-type.enum';

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
    description:
      'Phí khám riêng cho lịch này (VND). Nếu null sẽ dùng defaultConsultationFee của bác sĩ',
  })
  consultationFee?: string | null;

  @ApiPropertyOptional({
    example: '500000',
    description:
      'Phí khám thực tế (VND) - fallback từ schedule hoặc doctor.defaultConsultationFee',
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

  @ApiProperty({
    enum: ScheduleType,
    example: ScheduleType.REGULAR,
    description:
      'Loại lịch: REGULAR (cố định), FLEXIBLE (linh hoạt), TIME_OFF (nghỉ)',
  })
  scheduleType: ScheduleType;

  @ApiPropertyOptional({
    example: '2026-01-07',
    description: 'Ngày cụ thể (chỉ dùng cho FLEXIBLE/TIME_OFF)',
  })
  specificDate?: Date | null;

  @ApiPropertyOptional({
    example: 10,
    description: 'Giảm giá (%)',
  })
  discountPercent?: number;

  static fromEntity(schedule: {
    id: string;
    doctorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDuration: number;
    slotCapacity: number;
    appointmentType: AppointmentTypeEnum;
    minimumBookingTime: number;
    maxAdvanceBookingDays: number;
    consultationFee?: string | null;
    effectiveConsultationFee?: string | null;
    description?: string | null;
    isAvailable: boolean;
    effectiveFrom?: Date | null;
    effectiveUntil?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    scheduleType: ScheduleType;
    specificDate?: Date | null;
    discountPercent?: number;
  }): DoctorScheduleResponseDto {
    const dto = new DoctorScheduleResponseDto();
    dto.id = schedule.id;
    dto.doctorId = schedule.doctorId;
    dto.dayOfWeek = schedule.dayOfWeek;
    dto.startTime = schedule.startTime;
    dto.endTime = schedule.endTime;
    dto.slotDuration = schedule.slotDuration;
    dto.slotCapacity = schedule.slotCapacity;
    dto.appointmentType = schedule.appointmentType;
    dto.minimumBookingTime = schedule.minimumBookingTime;
    dto.maxAdvanceBookingDays = schedule.maxAdvanceBookingDays;
    dto.consultationFee = schedule.consultationFee ?? null;
    dto.effectiveConsultationFee = schedule.effectiveConsultationFee ?? null;
    dto.description = schedule.description ?? null;
    dto.isAvailable = schedule.isAvailable;
    dto.effectiveFrom = schedule.effectiveFrom ?? null;
    dto.effectiveUntil = schedule.effectiveUntil ?? null;
    dto.createdAt = schedule.createdAt;
    dto.updatedAt = schedule.updatedAt;
    dto.scheduleType = schedule.scheduleType;
    dto.specificDate = schedule.specificDate ?? null;
    dto.discountPercent = schedule.discountPercent;
    return dto;
  }

  static fromNullable(
    schedule:
      | Parameters<typeof DoctorScheduleResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): DoctorScheduleResponseDto | null {
    return schedule ? DoctorScheduleResponseDto.fromEntity(schedule) : null;
  }
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

  static fromEntity(slot: {
    id: string;
    doctorId: string;
    allowedAppointmentTypes: AppointmentTypeEnum[];
    startTime: Date;
    endTime: Date;
    capacity: number;
    bookedCount: number;
    isAvailable: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): TimeSlotResponseDto {
    const dto = new TimeSlotResponseDto();
    dto.id = slot.id;
    dto.doctorId = slot.doctorId;
    dto.allowedAppointmentTypes = slot.allowedAppointmentTypes;
    dto.startTime = slot.startTime;
    dto.endTime = slot.endTime;
    dto.capacity = slot.capacity;
    dto.bookedCount = slot.bookedCount;
    dto.isAvailable = slot.isAvailable;
    dto.createdAt = slot.createdAt;
    dto.updatedAt = slot.updatedAt;
    return dto;
  }

  static fromNullable(
    slot:
      | Parameters<typeof TimeSlotResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): TimeSlotResponseDto | null {
    return slot ? TimeSlotResponseDto.fromEntity(slot) : null;
  }
}
