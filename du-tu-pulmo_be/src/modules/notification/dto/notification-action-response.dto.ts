import { ApiProperty } from '@nestjs/swagger';

export class NotificationActionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}
