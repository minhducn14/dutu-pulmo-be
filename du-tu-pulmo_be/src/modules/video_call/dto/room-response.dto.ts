import { ApiProperty } from '@nestjs/swagger';

export class RoomResponseDto {
  @ApiProperty({
    description: 'ID của phòng họp',
    example: 'abc123xyz',
  })
  id: string;

  @ApiProperty({
    description: 'Tên phòng họp',
    example: 'appointment-123e4567-e89b-12d3-a456-426614174000',
  })
  name: string;

  @ApiProperty({
    description: 'URL để tham gia phòng họp',
    example: 'https://your-domain.daily.co/appointment-123e4567',
  })
  url: string;

  @ApiProperty({
    description: 'Token để xác thực khi tham gia cuộc gọi',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: false,
  })
  token?: string;
}

export class JoinCallResponseDto {
  @ApiProperty({
    description: 'URL để tham gia phòng họp',
    example: 'https://your-domain.daily.co/appointment-123e4567',
  })
  roomUrl: string;

  @ApiProperty({
    description: 'Tên phòng họp',
    example: 'appointment-123e4567-e89b-12d3-a456-426614174000',
  })
  roomName: string;

  @ApiProperty({
    description: 'Token để xác thực khi tham gia cuộc gọi',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token: string;

  @ApiProperty({
    description: 'ID của cuộc hẹn',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointmentId: string;
}

export class CallStatusResponseDto {
  @ApiProperty({
    description: 'User đang trong cuộc gọi hay không',
    example: true,
  })
  inCall: boolean;

  @ApiProperty({
    description: 'ID của cuộc hẹn nếu đang trong cuộc gọi',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  appointmentId?: string;

  @ApiProperty({
    description: 'Tên phòng họp nếu đang trong cuộc gọi',
    example: 'appointment-123e4567',
    required: false,
  })
  roomName?: string;

  @ApiProperty({
    description: 'Thời gian tham gia cuộc gọi',
    example: '2026-01-08T14:30:00.000Z',
    required: false,
  })
  joinedAt?: Date;
}

export class LeaveCallResponseDto {
  @ApiProperty({
    description: 'Thông báo',
    example: 'Left the call successfully',
  })
  message: string;
}
