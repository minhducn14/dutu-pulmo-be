import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FavoriteResponseDto {
  @ApiProperty({ example: 'b432ef6e-12e9-415d-acc8-5cb3c3cc285b' })
  id: string;

  @ApiProperty({ example: 'a17ee20d-cae4-422f-bf8c-11a8c0de4f32' })
  userId: string;

  @ApiPropertyOptional({ example: 'e320aa67-b53b-4c4a-bd50-31e8b312defa' })
  doctorId?: string;

  @ApiPropertyOptional({ example: 'f430bb78-c64c-5d5b-ce61-42f9c423efgb' })
  hospitalId?: string;

  @ApiProperty({
    example: '2024-07-16T10:30:15.000Z',
    description: 'Ngày thêm vào danh sách yêu thích',
  })
  createdAt: Date;

  static fromEntity(favorite: {
    id: string;
    userId: string;
    doctorId?: string | null;
    hospitalId?: string | null;
    createdAt: Date;
  }): FavoriteResponseDto {
    const dto = new FavoriteResponseDto();
    dto.id = favorite.id;
    dto.userId = favorite.userId;
    dto.doctorId = favorite.doctorId ?? undefined;
    dto.hospitalId = favorite.hospitalId ?? undefined;
    dto.createdAt = favorite.createdAt;
    return dto;
  }

  static fromNullable(
    favorite:
      | Parameters<typeof FavoriteResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): FavoriteResponseDto | null {
    return favorite ? FavoriteResponseDto.fromEntity(favorite) : null;
  }
}
