import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class SignMedicalRecordDto {
  @ApiProperty({ description: 'Digital signature data (base64 or hash)' })
  @IsString()
  signature: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'SHA-256 Hash của nội dung' })
  @IsOptional()
  @IsString()
  contentHash?: string;
}
