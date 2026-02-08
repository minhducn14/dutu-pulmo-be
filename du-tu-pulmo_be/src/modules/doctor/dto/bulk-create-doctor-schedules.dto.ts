import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDoctorScheduleDto } from './create-doctor-schedule.dto';

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
