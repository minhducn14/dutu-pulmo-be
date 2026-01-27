import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateReviewDto {
  @IsNotEmpty()
  @IsUUID()
  @ApiProperty({
    example: '98fdd9a4-5d91-4d8f-bf4d-71c68fa88961',
    description: 'ID bác sĩ được đánh giá',
  })
  doctorId: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: 'a120bb78-c64c-5d5b-ce61-42f9c423efgb',
    description: 'ID cuộc hẹn liên quan (nên có để xác thực đánh giá)',
  })
  appointmentId?: string;

  @IsString()
  @ApiProperty({
    example: 'Bác sĩ rất tận tâm, giải thích rõ ràng và chu đáo',
    description: 'Nội dung đánh giá',
  })
  comment: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @ApiProperty({
    example: 5,
    description: 'Số sao đánh giá (1-5)',
    minimum: 1,
    maximum: 5,
  })
  rating: number;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    example: false,
    description: 'Đánh giá ẩn danh',
    default: false,
  })
  isAnonymous?: boolean;
}
