import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateDoctorScheduleDto } from './create-doctor-schedule.dto';

/**
 * DTO for updating a doctor schedule (all fields optional).
 */
export class UpdateDoctorScheduleDto extends PartialType(CreateDoctorScheduleDto) {
  @ApiProperty({
    description: 'ID của lịch cần cập nhật (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  id: string;
}
