import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicalImageResponseDto {
  @ApiProperty({ example: '7d8c6d9b-92b1-4b62-8f1b-0d5a7b1c2e3f' })
  id: string;

  @ApiProperty({ example: 'd2c1b3a4-5e6f-7890-1234-56789abcdef0' })
  screeningId: string;

  @ApiPropertyOptional({ example: 'c3b2a1d4-5e6f-7890-1234-56789abcdef0' })
  medicalRecordId?: string;

  @ApiProperty({ example: 'https://res.cloudinary.com/.../originals/xray.jpg' })
  fileUrl: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../thumbs/xray.jpg',
  })
  thumbnailUrl?: string;

  @ApiProperty({ example: 'xray-001.dcm' })
  fileName: string;

  @ApiProperty({ example: 2048000, description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({ example: 'image/dicom' })
  mimeType: string;

  @ApiPropertyOptional({ example: 1024 })
  width?: number;

  @ApiPropertyOptional({ example: 1024 })
  height?: number;

  @ApiPropertyOptional({ example: 300 })
  dpi?: number;

  static fromEntity(image: {
    id: string;
    screeningId: string;
    medicalRecordId?: string | null;
    fileUrl: string;
    thumbnailUrl?: string | null;
    fileName: string;
    fileSize: number;
    mimeType: string;
    width?: number | null;
    height?: number | null;
    dpi?: number | null;
  }): MedicalImageResponseDto {
    const dto = new MedicalImageResponseDto();
    dto.id = image.id;
    dto.screeningId = image.screeningId;
    dto.medicalRecordId = image.medicalRecordId ?? undefined;
    dto.fileUrl = image.fileUrl;
    dto.thumbnailUrl = image.thumbnailUrl ?? undefined;
    dto.fileName = image.fileName;
    dto.fileSize = image.fileSize;
    dto.mimeType = image.mimeType;
    dto.width = image.width ?? undefined;
    dto.height = image.height ?? undefined;
    dto.dpi = image.dpi ?? undefined;
    return dto;
  }

  static fromNullable(
    image:
      | Parameters<typeof MedicalImageResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): MedicalImageResponseDto | null {
    return image ? MedicalImageResponseDto.fromEntity(image) : null;
  }
}
