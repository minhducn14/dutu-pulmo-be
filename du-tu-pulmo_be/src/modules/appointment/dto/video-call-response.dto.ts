import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentResponseDto } from './appointment-response.dto';

export class JoinVideoCallResponseDto {
  @ApiProperty({ example: 'token-value' })
  token: string;

  @ApiProperty({ example: 'https://example.daily.co/room' })
  url: string;

  @ApiPropertyOptional({ type: () => AppointmentResponseDto })
  appointment?: AppointmentResponseDto;
}

export class CurrentCallDto {
  @ApiProperty({ example: 'appointment-uuid' })
  appointmentId: string;

  @ApiProperty({ example: 'room-name' })
  roomName: string;

  @ApiProperty({ example: '2024-01-10T10:00:00Z' })
  joinedAt: Date;
}

export class UserCallStatusResponseDto {
  @ApiProperty({ example: false })
  inCall: boolean;

  @ApiPropertyOptional({ type: CurrentCallDto })
  currentCall?: CurrentCallDto;
}

export class VideoCallStatusResponseDto {
  @ApiProperty({ example: true })
  canJoin: boolean;

  @ApiProperty({ example: 'CONFIRMED' })
  appointmentStatus: string;

  @ApiPropertyOptional({ example: 'https://example.daily.co/room' })
  meetingUrl?: string;

  @ApiPropertyOptional({ example: '2024-01-10T10:00:00Z' })
  scheduledAt?: Date;

  @ApiPropertyOptional({ example: 30 })
  minutesUntilStart?: number;

  @ApiPropertyOptional({ example: false })
  isEarly?: boolean;

  @ApiPropertyOptional({ example: false })
  isLate?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['doctor-uuid'] })
  participantsInCall?: string[];

  @ApiPropertyOptional({
    example: 'Bạn có thể join video call',
  })
  message?: string;
}
