import {
  IsDateString,
  IsString,
  Matches,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

/**
 * DTO for creating a time-off schedule
 * Lịch nghỉ - khách hàng không thể đặt lịch khám hoặc tư vấn
 * Các lịch đã được bệnh nhân đặt trước sẽ bị hủy tự động
 */
export class CreateTimeOffDto {
  @ApiProperty({
    description: 'Ngày nghỉ (YYYY-MM-DD)',
    example: '2026-01-06',
  })
  @IsDateString()
  specificDate: string;

  @ApiProperty({ description: 'Giờ bắt đầu nghỉ (HH:mm)', example: '08:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'startTime phải đúng format HH:mm',
  })
  startTime: string;

  @ApiProperty({ description: 'Giờ kết thúc nghỉ (HH:mm)', example: '17:00' })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'endTime phải đúng format HH:mm',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Ghi chú',
    example: 'Nghỉ phép',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/**
 * DTO for updating a time-off schedule
 */
export class UpdateTimeOffDto extends PartialType(CreateTimeOffDto) {
  @ApiPropertyOptional({
    description: 'Bật/Tắt lịch nghỉ',
  })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
