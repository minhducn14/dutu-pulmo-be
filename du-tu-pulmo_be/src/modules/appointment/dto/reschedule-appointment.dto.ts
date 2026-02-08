import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RescheduleAppointmentDto {
  @ApiProperty({ description: 'ID của time slot mới' })
  @IsUUID()
  newTimeSlotId: string;
}
