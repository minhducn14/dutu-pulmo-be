import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for soft delete with audit info
 */
export class SoftDeleteScheduleDto {
  @ApiPropertyOptional({
    description: 'ID của user thực hiện xóa (để audit)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  deletedBy?: string;

  @ApiPropertyOptional({
    description: 'Lý do xóa lịch',
    example: 'Bác sĩ nghỉ phép dài hạn',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * DTO for querying deleted schedules
 */
export class GetDeletedSchedulesDto {
  @ApiPropertyOptional({
    description: 'Ngày bắt đầu lọc (deletedAt >= startDate)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc lọc (deletedAt <= endDate)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * DTO for restoring a deleted schedule
 */
export class RestoreScheduleDto {
  @ApiPropertyOptional({
    description: 'ID của user thực hiện restore',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsUUID()
  restoredBy?: string;
}

/**
 * DTO for permanent delete (admin only)
 */
export class PermanentDeleteDto {
  @ApiProperty({
    description: 'ID của admin thực hiện xóa vĩnh viễn',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  adminUserId: string;

  @ApiProperty({
    description: 'Xác nhận xóa vĩnh viễn (phải nhập: "PERMANENT_DELETE")',
    example: 'PERMANENT_DELETE',
  })
  @IsString()
  confirmation: string;
}

/**
 * Response DTO for deleted schedule (audit log)
 */
export class DeletedScheduleResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'REGULAR' })
  scheduleType: string;

  @ApiProperty({ example: 1 })
  dayOfWeek: number;

  @ApiProperty({ example: '08:00' })
  startTime: string;

  @ApiProperty({ example: '17:00' })
  endTime: string;

  @ApiProperty({ example: '2024-03-15T10:30:00Z' })
  deletedAt: Date;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  deletedBy: string | null;

  @ApiProperty({
    example: 'Bác sĩ nghỉ phép',
    nullable: true,
  })
  deletionReason: string | null;
}
