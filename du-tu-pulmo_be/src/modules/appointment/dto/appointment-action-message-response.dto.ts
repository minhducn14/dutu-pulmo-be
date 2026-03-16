import { ApiProperty } from '@nestjs/swagger';

export class AppointmentActionMessageResponseDto {
  @ApiProperty({ example: 'Left call successfully' })
  message: string;
}
