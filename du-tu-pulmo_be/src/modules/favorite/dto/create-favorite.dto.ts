import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateFavoriteDto {
  @IsOptional()
  @IsUUID()
  @ApiProperty({
    example: 'e320aa67-b53b-4c4a-bd50-31e8b312defa',
    description: 'ID của bác sĩ muốn thêm vào yêu thích',
    required: false,
  })
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  @ApiProperty({
    example: 'a120bb78-c64c-5d5b-ce61-42f9c423efgb',
    description: 'ID của bệnh viện muốn thêm vào yêu thích',
    required: false,
  })
  hospitalId?: string;
}
