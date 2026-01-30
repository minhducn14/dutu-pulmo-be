import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ScreeningRequest } from '@/modules/screening/entities/screening-request.entity';
import { AiAnalysis } from '@/modules/screening/entities/ai-analysis.entity';

@Entity('medical_images')
export class MedicalImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScreeningRequest, (sr) => sr.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screening_id' })
  screening: ScreeningRequest;

  @Column({ name: 'screening_id', type: 'uuid' })
  screeningId: string;

  @Column({ name: 'medical_record_id', type: 'uuid', nullable: true })
  medicalRecordId: string;

  @Column({ name: 'file_url', length: 500 })
  fileUrl: string;

  @Column({ name: 'thumbnail_url', length: 500, nullable: true })
  thumbnailUrl: string;

  @Column({ name: 'file_name', length: 255 })
  fileName: string;

  @Column({ name: 'file_size', type: 'integer' })
  fileSize: number; // bytes

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ type: 'integer', nullable: true })
  width: number;

  @Column({ type: 'integer', nullable: true })
  height: number;

  @Column({ type: 'integer', nullable: true })
  dpi: number;

  // Relations
  @OneToMany(() => AiAnalysis, (analysis) => analysis.medicalImage)
  aiAnalyses: AiAnalysis[];
}
