import { ApiProperty } from '@nestjs/swagger';

export class NotificationUnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  count: number;
}
