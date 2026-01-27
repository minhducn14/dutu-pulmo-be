import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AiDiagnosisStatusEnum } from '../../common/enums/ai-diagnosis-status.enum';
import type {
  AiFinding,
  AiGrayZoneNote,
  AiPrimaryDiagnosis,
} from '../entities/ai-analysis.entity';

export class AiAnalysisResponseDto {
  @ApiProperty({ example: '1e2f3a4b-5c6d-7e8f-9012-3456789abcde' })
  id: string;

  @ApiProperty({ example: 'd2c1b3a4-5e6f-7890-1234-56789abcdef0' })
  screeningId: string;

  @ApiProperty({ example: '7d8c6d9b-92b1-4b62-8f1b-0d5a7b1c2e3f' })
  medicalImageId: string;

  @ApiProperty({ example: 'YOLO11-VinBigData' })
  modelName: string;

  @ApiProperty({ example: 'yolo11-vinbigdata-v1' })
  modelVersion: string;

  @ApiPropertyOptional({ example: 'YOLO' })
  modelType?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  pulmoFileId?: string;

  @ApiProperty({
    enum: AiDiagnosisStatusEnum,
    example: AiDiagnosisStatusEnum.PENDING,
  })
  diagnosisStatus: AiDiagnosisStatusEnum;

  @ApiPropertyOptional({ type: Object })
  primaryDiagnosis?: AiPrimaryDiagnosis;

  @ApiPropertyOptional({ type: [Object] })
  findings?: AiFinding[];

  @ApiPropertyOptional({ type: [Object] })
  grayZoneNotes?: AiGrayZoneNote[];

  @ApiProperty({ example: 0 })
  totalFindings: number;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../original.jpg',
  })
  originalImageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../annotated.jpg',
  })
  annotatedImageUrl?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../evaluated.jpg',
  })
  evaluatedImageUrl?: string;

  @ApiPropertyOptional({ example: 'Cardiomegaly' })
  predictedCondition?: string;

  @ApiPropertyOptional({ example: 0.9123 })
  confidenceScore?: number;

  @ApiPropertyOptional({ type: [Object] })
  alternativePredictions?: { condition: string; score: number }[];

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../heatmap.jpg',
  })
  heatmapUrl?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../gradcam.jpg',
  })
  gradcamUrl?: string;

  @ApiPropertyOptional({ type: [Object] })
  detectionBoxes?: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    confidence: number;
  }[];

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../segmentation.png',
  })
  segmentationMaskUrl?: string;

  @ApiPropertyOptional({ example: 12345 })
  processingTimeMs?: number;

  @ApiPropertyOptional({ example: 'NVIDIA T4' })
  gpuUsed?: string;

  @ApiPropertyOptional({ example: 512 })
  memoryUsedMb?: number;

  @ApiProperty({ example: true })
  imageQualityPassed: boolean;

  @ApiPropertyOptional({ type: [String] })
  qualityIssues?: string[];

  @ApiPropertyOptional({ type: Object })
  rawPredictions?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  featureImportance?: Record<string, number>;

  @ApiPropertyOptional({ example: 'AI timeout' })
  errorMessage?: string;

  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  analyzedAt: Date;

  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  createdAt: Date;

  static fromEntity(analysis: {
    id: string;
    screeningId: string;
    medicalImageId: string;
    modelName: string;
    modelVersion: string;
    modelType?: string | null;
    pulmoFileId?: string | null;
    diagnosisStatus: AiDiagnosisStatusEnum;
    primaryDiagnosis?: AiPrimaryDiagnosis | null;
    findings?: AiFinding[] | null;
    grayZoneNotes?: AiGrayZoneNote[] | null;
    totalFindings: number;
    originalImageUrl?: string | null;
    annotatedImageUrl?: string | null;
    evaluatedImageUrl?: string | null;
    predictedCondition?: string | null;
    confidenceScore?: number | null;
    alternativePredictions?: { condition: string; score: number }[] | null;
    heatmapUrl?: string | null;
    gradcamUrl?: string | null;
    detectionBoxes?:
      | {
          x: number;
          y: number;
          width: number;
          height: number;
          label: string;
          confidence: number;
        }[]
      | null;
    segmentationMaskUrl?: string | null;
    processingTimeMs?: number | null;
    gpuUsed?: string | null;
    memoryUsedMb?: number | null;
    imageQualityPassed: boolean;
    qualityIssues?: string[] | null;
    rawPredictions?: Record<string, unknown> | null;
    featureImportance?: Record<string, number> | null;
    errorMessage?: string | null;
    analyzedAt: Date;
    createdAt: Date;
  }): AiAnalysisResponseDto {
    const dto = new AiAnalysisResponseDto();
    dto.id = analysis.id;
    dto.screeningId = analysis.screeningId;
    dto.medicalImageId = analysis.medicalImageId;
    dto.modelName = analysis.modelName;
    dto.modelVersion = analysis.modelVersion;
    dto.modelType = analysis.modelType ?? undefined;
    dto.pulmoFileId = analysis.pulmoFileId ?? undefined;
    dto.diagnosisStatus = analysis.diagnosisStatus;
    dto.primaryDiagnosis = analysis.primaryDiagnosis ?? undefined;
    dto.findings = analysis.findings ?? undefined;
    dto.grayZoneNotes = analysis.grayZoneNotes ?? undefined;
    dto.totalFindings = analysis.totalFindings;
    dto.originalImageUrl = analysis.originalImageUrl ?? undefined;
    dto.annotatedImageUrl = analysis.annotatedImageUrl ?? undefined;
    dto.evaluatedImageUrl = analysis.evaluatedImageUrl ?? undefined;
    dto.predictedCondition = analysis.predictedCondition ?? undefined;
    dto.confidenceScore = analysis.confidenceScore ?? undefined;
    dto.alternativePredictions = analysis.alternativePredictions ?? undefined;
    dto.heatmapUrl = analysis.heatmapUrl ?? undefined;
    dto.gradcamUrl = analysis.gradcamUrl ?? undefined;
    dto.detectionBoxes = analysis.detectionBoxes ?? undefined;
    dto.segmentationMaskUrl = analysis.segmentationMaskUrl ?? undefined;
    dto.processingTimeMs = analysis.processingTimeMs ?? undefined;
    dto.gpuUsed = analysis.gpuUsed ?? undefined;
    dto.memoryUsedMb = analysis.memoryUsedMb ?? undefined;
    dto.imageQualityPassed = analysis.imageQualityPassed;
    dto.qualityIssues = analysis.qualityIssues ?? undefined;
    dto.rawPredictions = analysis.rawPredictions ?? undefined;
    dto.featureImportance = analysis.featureImportance ?? undefined;
    dto.errorMessage = analysis.errorMessage ?? undefined;
    dto.analyzedAt = analysis.analyzedAt;
    dto.createdAt = analysis.createdAt;
    return dto;
  }

  static fromNullable(
    analysis:
      | Parameters<typeof AiAnalysisResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): AiAnalysisResponseDto | null {
    return analysis ? AiAnalysisResponseDto.fromEntity(analysis) : null;
  }
}
