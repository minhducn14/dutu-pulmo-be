import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Request DTO for triggering AI analysis on a medical image
 */
export class TriggerAiAnalysisDto {
  @ApiPropertyOptional({
    description:
      'Optional model version to use. If not specified, uses default model.',
    example: 'yolo11-vinbigdata-v1',
  })
  @IsOptional()
  @IsString()
  modelVersion?: string;
}

/**
 * Response DTO for AI analysis trigger
 */
export class AiAnalysisTriggerResponseDto {
  @ApiProperty({ description: 'AI Analysis ID' })
  id: string;

  @ApiProperty({ description: 'Screening ID' })
  screeningId: string;

  @ApiProperty({ description: 'Medical Image ID' })
  medicalImageId: string;

  @ApiProperty({ description: 'Diagnosis status', example: 'DETECTED' })
  diagnosisStatus: string;

  @ApiPropertyOptional({ description: 'Primary diagnosis object' })
  primaryDiagnosis?: Record<string, any>;

  @ApiPropertyOptional({ description: 'All findings array' })
  findings?: Record<string, any>[];

  @ApiPropertyOptional({ description: 'Gray zone notes array' })
  grayZoneNotes?: Record<string, any>[];

  @ApiProperty({
    description: 'Total number of validated findings',
    example: 2,
  })
  totalFindings: number;

  @ApiPropertyOptional({ description: 'URL of original image on Cloudinary' })
  originalImageUrl?: string;

  @ApiPropertyOptional({
    description: 'URL of evaluated image with risk-colored bboxes',
  })
  evaluatedImageUrl?: string;

  @ApiProperty({ description: 'Analysis timestamp' })
  analyzedAt: Date;
}
