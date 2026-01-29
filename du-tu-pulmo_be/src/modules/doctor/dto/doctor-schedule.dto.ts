import {
  IsInt,
  IsString,
  Matches,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsNumber,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ValidateNested } from 'class-validator';
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { IsValidBookingWindow } from '@/modules/doctor/validators/is-valid-booking-window.decorator';

/**
 * DTO for creating a regular (fixed) doctor schedule.
 * Lịch cố định - lặp lại theo thứ trong tuần.
 */
export class CreateDoctorScheduleDto {
  @ApiProperty({
    description: 'Ngày trong tuần (0=CN, 1=T2, ..., 6=T7)',
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiPropertyOptional({
    example: 'Ghi chú lịch làm việc',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ description: 'Giờ bắt đầu (HH:mm)', example: '09:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime phải đúng format HH:mm',
  })
  startTime: string;

  @ApiProperty({ description: 'Giờ kết thúc (HH:mm)', example: '17:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime phải đúng format HH:mm',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Thời gian mỗi slot (phút)',
    minimum: 10,
    maximum: 120,
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  slotDuration?: number = 30;

  @ApiPropertyOptional({
    description: 'Số lượng bệnh nhân mỗi slot',
    minimum: 1,
    maximum: 10,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  slotCapacity?: number = 1;

  @ApiProperty({ description: 'Loại hình khám', enum: AppointmentTypeEnum })
  @IsEnum(AppointmentTypeEnum)
  appointmentType: AppointmentTypeEnum;

  @ApiPropertyOptional({
    description: 'Số ngày phải đặt khám trước',
    default: 0,
    example: 1,
    minimum: 0,
    maximum: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  minimumBookingDays?: number = 0;

  @ApiPropertyOptional({
    description: 'Số ngày đặt khám xa nhất',
    default: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @IsValidBookingWindow()
  maxAdvanceBookingDays?: number = 30;

  @ApiPropertyOptional({ description: 'Phí khám (VND)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  @ApiPropertyOptional({
    description: 'Giảm giá (%)',
    minimum: 0,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Mô tả thêm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động', default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean = true;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu hiệu lực (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc hiệu lực (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string;
}

/**
 * DTO for updating a doctor schedule (all fields optional).
 */
export class UpdateDoctorScheduleDto {
  @ApiPropertyOptional({
    description: 'Ngày trong tuần (0=CN, 1=T2, ..., 6=T7)',
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    enum: ScheduleType,
    example: ScheduleType.REGULAR,
    description: 'Loại lịch',
  })
  @IsOptional()
  @IsEnum(ScheduleType)
  scheduleType?: ScheduleType;

  @ApiPropertyOptional({
    example: 'Ghi chú',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'Giờ bắt đầu (HH:mm)', example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime phải đúng format HH:mm',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Giờ kết thúc (HH:mm)',
    example: '17:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime phải đúng format HH:mm',
  })
  endTime?: string;

  @ApiPropertyOptional({ description: 'Thời gian mỗi slot (phút)' })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  slotDuration?: number;

  @ApiPropertyOptional({ description: 'Số lượng bệnh nhân mỗi slot' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  slotCapacity?: number;

  @ApiPropertyOptional({
    description: 'Loại hình khám',
    enum: AppointmentTypeEnum,
  })
  @IsOptional()
  @IsEnum(AppointmentTypeEnum)
  appointmentType?: AppointmentTypeEnum;

  @ApiPropertyOptional({ description: 'Số ngày phải đặt khám trước' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  minimumBookingDays?: number;

  @ApiPropertyOptional({ description: 'Số ngày đặt khám xa nhất' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @IsValidBookingWindow()
  maxAdvanceBookingDays?: number;

  @ApiPropertyOptional({ description: 'Phí khám (VND)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number | null;

  @ApiPropertyOptional({ description: 'Mô tả thêm' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu hiệu lực (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @ApiPropertyOptional({ description: 'Ngày kết thúc hiệu lực (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string | null;
}

/**
 * DTO for bulk creating multiple doctor schedules in one request.
 * Useful for setting up weekly schedules with multiple time slots per day.
 */
export class BulkCreateDoctorSchedulesDto {
  @ApiProperty({
    description: 'Danh sách lịch làm việc cần tạo (tối đa 20)',
    type: [CreateDoctorScheduleDto],
    example: [
      {
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
        appointmentType: 'IN_CLINIC',
      },
      {
        dayOfWeek: 1,
        startTime: '13:00',
        endTime: '17:00',
        appointmentType: 'IN_CLINIC',
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => CreateDoctorScheduleDto)
  @ArrayMinSize(1, { message: 'Phải có ít nhất 1 lịch làm việc' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 lịch làm việc mỗi request' })
  schedules: CreateDoctorScheduleDto[];
}

/**
 * DTO for single item in bulk update request.
 * Kết hợp schedule ID với dữ liệu cần cập nhật.
 */
export class BulkUpdateItemDto {
  @ApiProperty({
    description: 'ID của lịch cần cập nhật (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  id: string;

  @ApiPropertyOptional({
    description: 'Ngày trong tuần (0=CN, 1=T2, ..., 6=T7)',
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({
    example: 'Ghi chú',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiPropertyOptional({ description: 'Giờ bắt đầu (HH:mm)', example: '09:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime phải đúng format HH:mm',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Giờ kết thúc (HH:mm)',
    example: '17:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime phải đúng format HH:mm',
  })
  endTime?: string;

  @ApiPropertyOptional({ description: 'Thời gian mỗi slot (phút)' })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(120)
  slotDuration?: number;

  @ApiPropertyOptional({ description: 'Số lượng bệnh nhân mỗi slot' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  slotCapacity?: number;

  @ApiPropertyOptional({
    description: 'Loại hình khám',
    enum: AppointmentTypeEnum,
  })
  @IsOptional()
  @IsEnum(AppointmentTypeEnum)
  appointmentType?: AppointmentTypeEnum;

  @ApiPropertyOptional({ description: 'Phí khám (VND)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  consultationFee?: number | null;

  @ApiPropertyOptional({ description: 'Trạng thái hoạt động' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu hiệu lực (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @ApiPropertyOptional({ description: 'Ngày kết thúc hiệu lực (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effectiveUntil?: string | null;
}

/**
 * DTO for bulk updating multiple doctor schedules in one request.
 * Cho phép cập nhật nhiều lịch REGULAR cùng lúc.
 */
export class BulkUpdateDoctorSchedulesDto {
  @ApiProperty({
    description: 'Danh sách lịch làm việc cần cập nhật (tối đa 20)',
    type: [BulkUpdateItemDto],
    example: [
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        startTime: '08:00',
        endTime: '12:00',
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        isAvailable: false,
      },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  @ArrayMinSize(1, { message: 'Phải có ít nhất 1 lịch làm việc' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 lịch làm việc mỗi request' })
  schedules: BulkUpdateItemDto[];
}
