import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConfigValueTypeEnum } from '@/modules/common/enums/config-value-type.enum';

export class SystemConfigResponseDto {
  @ApiProperty({ example: '8c9a9b3f-2e7f-4e5b-9b4d-5c7c6b0a2f6e' })
  id: string;

  @ApiProperty({ example: 'MAX_SCREENINGS_PER_DAY' })
  key: string;

  @ApiProperty({ example: '10' })
  value: string;

  @ApiPropertyOptional({ example: 'Max screenings per day' })
  description?: string;

  @ApiProperty({
    enum: ConfigValueTypeEnum,
    example: ConfigValueTypeEnum.STRING,
  })
  valueType: ConfigValueTypeEnum;

  @ApiPropertyOptional({ example: 'SCREENING' })
  category?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: false })
  isPublic: boolean;

  @ApiPropertyOptional({ example: 'c1b6cf11-1d1b-4b3c-a2d4-0f1c9d0e3f5d' })
  updatedBy?: string;

  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  updatedAt: Date;

  static fromEntity(config: {
    id: string;
    key: string;
    value: string;
    description?: string | null;
    valueType: ConfigValueTypeEnum;
    category?: string | null;
    isActive: boolean;
    isPublic: boolean;
    updatedBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): SystemConfigResponseDto {
    const dto = new SystemConfigResponseDto();
    dto.id = config.id;
    dto.key = config.key;
    dto.value = config.value;
    dto.description = config.description ?? undefined;
    dto.valueType = config.valueType;
    dto.category = config.category ?? undefined;
    dto.isActive = config.isActive;
    dto.isPublic = config.isPublic;
    dto.updatedBy = config.updatedBy ?? undefined;
    dto.createdAt = config.createdAt;
    dto.updatedAt = config.updatedAt;
    return dto;
  }

  static fromNullable(
    config:
      | Parameters<typeof SystemConfigResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): SystemConfigResponseDto | null {
    return config ? SystemConfigResponseDto.fromEntity(config) : null;
  }
}
