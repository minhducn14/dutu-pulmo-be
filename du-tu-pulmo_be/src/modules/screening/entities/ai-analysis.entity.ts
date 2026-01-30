import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { ScreeningRequest } from '@/modules/screening/entities/screening-request.entity';
import { MedicalImage } from '@/modules/screening/entities/medical-image.entity';
import { AiDiagnosisStatusEnum } from '@/modules/common/enums/ai-diagnosis-status.enum';

export interface AiPrimaryDiagnosis {
  label: string;
  name_vn: string;
  risk_level: string;
  confidence_level?: string;
  recommendation: string;
  color: string;
  probability?: number;
}

export interface AiFinding {
  label: string;
  name_vn: string;
  probability: number;
  risk_level: string;
  confidence_level: string;
  recommendation: string;
  bbox?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export interface AiGrayZoneNote {
  label: string;
  name_vn: string;
  probability: number;
  required_threshold: number;
  bbox?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

@Entity('ai_analyses')
@Unique('uk_ai_analysis_unique', [
  'screeningId',
  'medicalImageId',
  'modelVersion',
])
@Index('idx_ai_analysis_screening', ['screeningId', 'analyzedAt'])
@Index('idx_ai_analysis_status', ['diagnosisStatus'])
export class AiAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScreeningRequest, (sr) => sr.aiAnalyses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'screening_id' })
  screening: ScreeningRequest;

  @Column({ name: 'screening_id', type: 'uuid' })
  screeningId: string;

  @ManyToOne(() => MedicalImage, (img) => img.aiAnalyses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'medical_image_id' })
  medicalImage: MedicalImage;

  @Column({ name: 'medical_image_id', type: 'uuid' })
  medicalImageId: string;

  // ============================================
  // THÔNG TIN MÔ HÌNH AI (AI Model Info)
  // ============================================

  /** Tên model AI: VD: "YOLO11-VinBigData" */
  @Column({ name: 'model_name', length: 100 })
  modelName: string;

  @Column({ name: 'model_version', length: 50 })
  modelVersion: string;

  @Column({ name: 'model_type', length: 50, nullable: true })
  modelType: string;

  // ============================================
  // PULMO_AI INTEGRATION FIELDS
  // ============================================

  @Column({ name: 'pulmo_file_id', length: 100, nullable: true })
  pulmoFileId: string;

  @Column({
    name: 'diagnosis_status',
    type: 'enum',
    enum: AiDiagnosisStatusEnum,
    default: AiDiagnosisStatusEnum.PENDING,
  })
  diagnosisStatus: AiDiagnosisStatusEnum;

  @Column({ name: 'primary_diagnosis', type: 'jsonb', nullable: true })
  primaryDiagnosis: AiPrimaryDiagnosis;

  @Column({ name: 'findings', type: 'jsonb', nullable: true })
  findings: AiFinding[];

  @Column({ name: 'gray_zone_notes', type: 'jsonb', nullable: true })
  grayZoneNotes: AiGrayZoneNote[];

  @Column({ name: 'total_findings', type: 'integer', default: 0 })
  totalFindings: number;

  @Column({ name: 'original_image_url', length: 500, nullable: true })
  originalImageUrl: string;

  @Column({ name: 'annotated_image_url', length: 500, nullable: true })
  annotatedImageUrl: string;

  @Column({ name: 'evaluated_image_url', length: 500, nullable: true })
  evaluatedImageUrl: string;

  // ============================================
  // LEGACY FIELDS (kept for backward compatibility)
  // ============================================

  @Column({ name: 'predicted_condition', length: 100, nullable: true })
  predictedCondition: string;

  @Column({
    name: 'confidence_score',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  confidenceScore: number;

  @Column({ name: 'alternative_predictions', type: 'jsonb', nullable: true })
  alternativePredictions: { condition: string; score: number }[];

  @Column({ name: 'heatmap_url', length: 500, nullable: true })
  heatmapUrl: string;

  @Column({ name: 'gradcam_url', length: 500, nullable: true })
  gradcamUrl: string;

  @Column({ name: 'detection_boxes', type: 'jsonb', nullable: true })
  detectionBoxes: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
    confidence: number;
  }[];

  @Column({ name: 'segmentation_mask_url', length: 500, nullable: true })
  segmentationMaskUrl: string;

  @Column({ name: 'processing_time_ms', type: 'integer', nullable: true })
  processingTimeMs: number;

  @Column({ name: 'gpu_used', length: 50, nullable: true })
  gpuUsed: string;

  @Column({ name: 'memory_used_mb', type: 'integer', nullable: true })
  memoryUsedMb: number;

  @Column({ name: 'image_quality_passed', default: true })
  imageQualityPassed: boolean;

  @Column({ name: 'quality_issues', type: 'text', array: true, nullable: true })
  qualityIssues: string[];

  @Column({ name: 'raw_predictions', type: 'jsonb', nullable: true })
  rawPredictions: Record<string, any>;

  @Column({ name: 'feature_importance', type: 'jsonb', nullable: true })
  featureImportance: Record<string, number>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({
    name: 'analyzed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  analyzedAt: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
