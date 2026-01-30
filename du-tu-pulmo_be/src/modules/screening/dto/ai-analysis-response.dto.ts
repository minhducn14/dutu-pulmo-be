import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { AiRiskLevelEnum } from '@/modules/common/enums/ai-risk-level.enum';

/**
 * Bounding box coordinates from YOLO detection
 */
export class AiBoundingBoxDto {
  @ApiProperty({ example: 350.3, description: 'X1 coordinate (top-left)' })
  @IsNumber()
  x1: number;

  @ApiProperty({ example: 672.22, description: 'Y1 coordinate (top-left)' })
  @IsNumber()
  y1: number;

  @ApiProperty({ example: 924.8, description: 'X2 coordinate (bottom-right)' })
  @IsNumber()
  x2: number;

  @ApiProperty({ example: 947.91, description: 'Y2 coordinate (bottom-right)' })
  @IsNumber()
  y2: number;
}

/**
 * Individual finding from AI analysis
 */
export class AiFindingDto {
  @ApiProperty({
    example: 'Cardiomegaly',
    description: 'Disease label in English',
  })
  @IsString()
  label: string;

  @ApiProperty({
    example: 'Bóng tim to',
    description: 'Disease name in Vietnamese',
  })
  @IsString()
  name_vn: string;

  @ApiProperty({ example: 0.7572, description: 'Detection probability (0-1)' })
  @IsNumber()
  @Min(0)
  @Max(1)
  probability: number;

  @ApiProperty({ enum: AiRiskLevelEnum, example: 'Warning' })
  @IsString()
  risk_level: string;

  @ApiProperty({
    example: 'High',
    description: 'Confidence level (High/Medium)',
  })
  @IsString()
  confidence_level: string;

  @ApiProperty({
    example: 'Khám tim mạch trong 2-4 tuần...',
    description: 'Medical recommendation',
  })
  @IsString()
  recommendation: string;

  @ApiPropertyOptional({ type: AiBoundingBoxDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiBoundingBoxDto)
  bbox?: AiBoundingBoxDto;
}

/**
 * Primary diagnosis from AI analysis
 */
export class AiPrimaryDiagnosisDto {
  @ApiProperty({ example: 'Cardiomegaly' })
  @IsString()
  label: string;

  @ApiProperty({ example: 'Bóng tim to' })
  @IsString()
  name_vn: string;

  @ApiProperty({ enum: AiRiskLevelEnum, example: 'Warning' })
  @IsString()
  risk_level: string;

  @ApiPropertyOptional({ example: 'High' })
  @IsOptional()
  @IsString()
  confidence_level?: string;

  @ApiProperty({ example: 'Khám tim mạch trong 2-4 tuần...' })
  @IsString()
  recommendation: string;

  @ApiProperty({ example: '#FFA500', description: 'Risk level color code' })
  @IsString()
  color: string;

  @ApiPropertyOptional({ example: 0.7572 })
  @IsOptional()
  @IsNumber()
  probability?: number;
}

/**
 * Gray zone finding (below threshold but notable)
 */
export class AiGrayZoneDto {
  @ApiProperty({ example: 'Aortic enlargement' })
  @IsString()
  label: string;

  @ApiProperty({ example: 'Phình/Giãn động mạch chủ' })
  @IsString()
  name_vn: string;

  @ApiProperty({ example: 0.609, description: 'Detection probability' })
  @IsNumber()
  probability: number;

  @ApiProperty({
    example: 0.8,
    description: 'Required threshold for confirmation',
  })
  @IsNumber()
  required_threshold: number;

  @ApiPropertyOptional({ type: AiBoundingBoxDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiBoundingBoxDto)
  bbox?: AiBoundingBoxDto;
}

/**
 * AI Analysis data payload from pulmo_ai
 */
export class AiAnalysisDataDto {
  @ApiProperty({ example: 'DETECTED', description: 'DETECTED or UNCERTAIN' })
  @IsString()
  diagnosis_status: string;

  @ApiProperty({ type: AiPrimaryDiagnosisDto })
  @ValidateNested()
  @Type(() => AiPrimaryDiagnosisDto)
  primary_diagnosis: AiPrimaryDiagnosisDto;

  @ApiProperty({
    type: [AiFindingDto],
    description: 'Validated findings above threshold',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiFindingDto)
  findings: AiFindingDto[];

  @ApiProperty({
    type: [AiGrayZoneDto],
    description: 'Findings below threshold but notable',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiGrayZoneDto)
  gray_zone_notes: AiGrayZoneDto[];

  @ApiProperty({
    example: 2,
    description: 'Total number of validated findings',
  })
  @IsNumber()
  total_findings: number;
}

/**
 * Full response from pulmo_ai /api/v1/predict endpoint
 */
export class PulmoAiResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  file_id?: string;

  @ApiPropertyOptional({ type: AiAnalysisDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiAnalysisDataDto)
  data?: AiAnalysisDataDto;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../originals/xxx_original.jpg',
  })
  @IsOptional()
  @IsString()
  original_image_url?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../predictions/xxx_annotated.jpg',
  })
  @IsOptional()
  @IsString()
  annotated_image_url?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../evaluated/xxx_evaluated.jpg',
  })
  @IsOptional()
  @IsString()
  evaluated_image_url?: string;

  @ApiPropertyOptional({ description: 'Error message if success is false' })
  @IsOptional()
  @IsString()
  error?: string;
}
