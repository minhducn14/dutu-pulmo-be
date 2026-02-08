import {
  IsDateString,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsEnum,
  IsArray,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';

/**
 * DTO for creating a single time slot.
 */
export class CreateTimeSlotDto {
  @ApiProperty({
    description: 'Thời gian bắt đầu (ISO 8601)',
    example: '2026-01-10T09:00:00+07:00',
  })
  @IsDateString()
  startTime: string;

  @ApiProperty({
    description: 'Thời gian kết thúc (ISO 8601)',
    example: '2026-01-10T09:30:00+07:00',
  })
  @IsDateString()
  endTime: string;

  @ApiProperty({
    description: 'Các loại hình khám được phép',
    type: [String],
    enum: AppointmentTypeEnum,
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AppointmentTypeEnum, { each: true })
  allowedAppointmentTypes: AppointmentTypeEnum[];

  @ApiPropertyOptional({
    description: 'Số lượng bệnh nhân tối đa',
    minimum: 1,
    maximum: 10,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  capacity?: number = 1;

  @ApiPropertyOptional({ description: 'Trạng thái có thể đặt', default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean = true;

  @ApiPropertyOptional({ description: 'ID của lịch làm việc liên kết' })
  @IsOptional()
  @IsUUID()
  scheduleId?: string;

  @ApiPropertyOptional({
    description: 'Version của schedule tại thời điểm tạo slot',
  })
  @IsOptional()
  @IsInt()
  scheduleVersion?: number;
}

/**
 * DTO for bulk creating time slots.
 * Limited to 100 slots per request for performance.
 */
export class BulkCreateTimeSlotsDto {
  @ApiProperty({
    description: 'Danh sách time slots (tối đa 100)',
    type: [CreateTimeSlotDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateTimeSlotDto)
  slots: CreateTimeSlotDto[];
}

/**
 * DTO for updating a time slot.
 */
export class UpdateTimeSlotDto {
  @ApiPropertyOptional({ description: 'Thời gian bắt đầu (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Thời gian kết thúc (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endTime?: string;
  @ApiPropertyOptional()

  // @ApiPropertyOptional({
  //   description: 'Các loại hình khám được phép',
  //   type: [String],
  //   enum: AppointmentTypeEnum,
  // })
  // @IsOptional()
  // @IsArray()
  // @ArrayMinSize(1)
  // @IsEnum(AppointmentTypeEnum, { each: true })
  // allowedAppointmentTypes?: AppointmentTypeEnum[];

  @ApiPropertyOptional({ description: 'Số lượng bệnh nhân tối đa' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  capacity?: number;

  @ApiPropertyOptional({ description: 'Trạng thái có thể đặt' })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}

/**
 * Query DTO for finding available slots.
 */
export class FindAvailableSlotsQueryDto {
  @ApiProperty({
    description: 'Ngày cần tìm (YYYY-MM-DD)',
    example: '2026-01-10',
  })
  @IsDateString()
  date: string;
}

/**
 * DTO for auto-generating time slots from a schedule.
 */
export class GenerateSlotsDto {
  @ApiProperty({
    description: 'Ngày bắt đầu generate (YYYY-MM-DD)',
    example: '2026-01-05',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    description: 'Ngày kết thúc generate (YYYY-MM-DD, tối đa 90 ngày)',
    example: '2026-01-31',
  })
  @IsDateString()
  endDate: string;
}

/**
 * DTO for toggling a single slot's availability.
 */
export class ToggleSlotAvailabilityDto {
  @ApiProperty({ description: 'Trạng thái có thể đặt', example: false })
  @IsBoolean()
  isAvailable: boolean;
}

/**
 * DTO for bulk toggling multiple slots' availability.
 */
export class BulkToggleSlotsDto {
  @ApiProperty({
    description: 'Danh sách slot IDs (tối đa 100)',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  slotIds: string[];

  @ApiProperty({ description: 'Trạng thái có thể đặt', example: false })
  @IsBoolean()
  isAvailable: boolean;
}

/**
 * DTO for disabling all slots for a specific day.
 */
export class DisableSlotsForDayDto {
  @ApiProperty({
    description: 'Ngày cần tắt slots (YYYY-MM-DD)',
    example: '2026-01-15',
  })
  @IsDateString()
  date: string;
}

/**
 * DTO for querying availability summary.
 */
export class AvailabilitySummaryQueryDto {
  @ApiProperty({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    example: '2026-03-13',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    example: '2026-03-20',
  })
  @IsDateString()
  to: string;
}

/**
 * DTO for availability summary response.
 */
export class AvailabilitySummaryResponseDto {
  @ApiProperty({ description: 'Ngày (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: 'Số lượng slot còn trống' })
  count: number;

  @ApiProperty({ description: 'Có slot nào trống không' })
  hasAvailability: boolean;
}
