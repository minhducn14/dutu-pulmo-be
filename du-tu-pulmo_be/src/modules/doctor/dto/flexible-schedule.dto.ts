import {
  IsDateString,
  IsEnum,
  IsString,
  Matches,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { IsValidBookingWindow } from '../validators/is-valid-booking-window.decorator';

/**
 * DTO for creating a flexible working schedule (single date, non-recurring)
 * Lịch làm việc linh hoạt - chỉ áp dụng cho ngày đã chọn, không lặp lại
 */
export class CreateFlexibleScheduleDto {
  @ApiProperty({
    description: 'Ngày khám cụ thể (YYYY-MM-DD)',
    example: '2026-01-07',
  })
  @IsDateString()
  specificDate: string;

  @ApiProperty({
    description: 'Loại lịch làm việc',
    enum: AppointmentTypeEnum,
    example: AppointmentTypeEnum.IN_CLINIC,
  })
  @IsEnum(AppointmentTypeEnum)
  appointmentType: AppointmentTypeEnum;

  @ApiProperty({ description: 'Giờ bắt đầu (HH:mm)', example: '08:00' })
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

  @ApiProperty({
    description: 'Số lượt khám trên một slot',
    minimum: 1,
    maximum: 20,
    example: 4,
  })
  @IsInt()
  @Min(1)
  @Max(20)
  slotCapacity: number;

  @ApiProperty({
    description: 'Thời gian 1 slot (phút)',
    minimum: 10,
    maximum: 120,
    example: 30,
  })
  @IsInt()
  @Min(10)
  @Max(120)
  slotDuration: number;

  @ApiPropertyOptional({
    description: 'Số ngày phải đặt khám trước (ngày)',
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
    example: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @IsValidBookingWindow()
  maxAdvanceBookingDays?: number = 30;

  @ApiPropertyOptional({
    description: 'Phí khám (VND)',
    example: 500000,
  })
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

  @ApiPropertyOptional({
    description: 'Bật/Tắt lịch',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

/**
 * DTO for updating a flexible schedule
 */
export class UpdateFlexibleScheduleDto extends PartialType(
  CreateFlexibleScheduleDto,
) {}
