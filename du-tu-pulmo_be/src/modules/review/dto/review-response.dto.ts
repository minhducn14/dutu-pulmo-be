import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewResponseDto {
  @ApiProperty({ example: '72e75314-54c5-441f-9dbd-4fd3469ea9e0' })
  id: string;

  @ApiProperty({ example: 'd5b3a3c9-1762-4bd8-b160-26061c747fa3' })
  reviewerId: string;

  @ApiProperty({ example: '98fdd9a4-5d91-4d8f-bf4d-71c68fa88961' })
  doctorId: string;

  @ApiPropertyOptional({ example: 'a120bb78-c64c-5d5b-ce61-42f9c423efgb' })
  appointmentId?: string;

  @ApiProperty({ example: 'Bác sĩ rất tận tâm, giải thích rõ ràng và chu đáo' })
  comment: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  rating: number;

  @ApiPropertyOptional({ example: 'Cảm ơn bạn đã tin tưởng và đánh giá!' })
  doctorResponse?: string;

  @ApiPropertyOptional({ example: '2024-07-17T09:00:00.000Z' })
  responseAt?: Date;

  @ApiProperty({ example: false })
  isAnonymous: boolean;

  @ApiProperty({
    example: '2024-07-15T10:20:30.000Z',
    description: 'Ngày tạo đánh giá',
  })
  createdAt: Date;

  static fromEntity(review: {
    id: string;
    reviewerId?: string | null;
    doctorId?: string | null;
    appointmentId?: string | null;
    comment: string;
    rating: number;
    doctorResponse?: string | null;
    responseAt?: Date | null;
    isAnonymous: boolean;
    createdAt: Date;
  }): ReviewResponseDto {
    const dto = new ReviewResponseDto();
    dto.id = review.id;
    dto.reviewerId = review.reviewerId ?? '';
    dto.doctorId = review.doctorId ?? '';
    dto.appointmentId = review.appointmentId ?? undefined;
    dto.comment = review.comment;
    dto.rating = review.rating;
    dto.doctorResponse = review.doctorResponse ?? undefined;
    dto.responseAt = review.responseAt ?? undefined;
    dto.isAnonymous = review.isAnonymous;
    dto.createdAt = review.createdAt;
    return dto;
  }

  static fromNullable(
    review:
      | Parameters<typeof ReviewResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): ReviewResponseDto | null {
    return review ? ReviewResponseDto.fromEntity(review) : null;
  }
}
