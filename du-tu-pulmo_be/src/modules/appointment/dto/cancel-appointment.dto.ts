import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CancelAppointmentDto {
  @ApiProperty({ description: 'Lý do hủy lịch' })
  @IsString()
  @MaxLength(500)
  reason: string;
}
