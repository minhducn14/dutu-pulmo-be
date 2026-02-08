import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CheckInByNumberDto {
  @ApiProperty({
    description: 'Mã lịch hẹn (từ QR code)',
    example: 'APT-20240204-001',
  })
  @IsString()
  @MaxLength(50)
  appointmentNumber: string;
}
