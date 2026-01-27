import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CloudinaryUploadResponseDto {
  @ApiProperty({ example: 'https://res.cloudinary.com/.../image.jpg' })
  url: string;

  @ApiProperty({ example: 'images/abcd1234' })
  publicId: string;

  @ApiPropertyOptional({ example: 1024 })
  width?: number;

  @ApiPropertyOptional({ example: 768 })
  height?: number;

  @ApiPropertyOptional({ example: 'jpg' })
  format?: string;

  @ApiPropertyOptional({ example: 2048000 })
  bytes?: number;

  static fromEntity(data: {
    url: string;
    publicId: string;
    width?: number | null;
    height?: number | null;
    format?: string | null;
    bytes?: number | null;
  }): CloudinaryUploadResponseDto {
    const dto = new CloudinaryUploadResponseDto();
    dto.url = data.url;
    dto.publicId = data.publicId;
    dto.width = data.width ?? undefined;
    dto.height = data.height ?? undefined;
    dto.format = data.format ?? undefined;
    dto.bytes = data.bytes ?? undefined;
    return dto;
  }
}
