import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateDoctorScheduleDto } from './update-doctor-schedule.dto';

/**
 * DTO for bulk updating multiple doctor schedules in one request.
 * Cho phép cập nhật nhiều lịch REGULAR cùng lúc.
 */
export class BulkUpdateDoctorSchedulesDto {
  @ApiProperty({
    description: 'Danh sách lịch làm việc cần cập nhật (tối đa 20)',
    type: [UpdateDoctorScheduleDto],
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
  @Type(() => UpdateDoctorScheduleDto)
  @ArrayMinSize(1, { message: 'Phải có ít nhất 1 lịch làm việc' })
  @ArrayMaxSize(20, { message: 'Tối đa 20 lịch làm việc mỗi request' })
  schedules: UpdateDoctorScheduleDto[];
}
