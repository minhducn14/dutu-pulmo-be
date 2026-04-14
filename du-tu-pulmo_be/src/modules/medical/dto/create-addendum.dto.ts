import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateAddendumDto {
  @ApiProperty({ description: 'Lý do thực hiện đính chính (bắt buộc)' })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Nội dung đính chính/bổ sung' })
  @IsNotEmpty()
  @IsString()
  content: string;
}
