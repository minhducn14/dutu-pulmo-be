import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateReviewDto } from './create-review.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateReviewDto extends PartialType(
  OmitType(CreateReviewDto, ['doctorId', 'appointmentId'] as const),
) {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Cảm ơn bạn đã tin tưởng và đánh giá!',
    description: 'Phản hồi của bác sĩ',
  })
  doctorResponse?: string;
}
