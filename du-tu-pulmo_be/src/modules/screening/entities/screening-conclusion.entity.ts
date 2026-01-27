import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ScreeningRequest } from './screening-request.entity';
import { AiAnalysis } from './ai-analysis.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';

@Entity('screening_conclusions')
export class ScreeningConclusion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScreeningRequest, (sr) => sr.conclusions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'screening_id' })
  screening: ScreeningRequest;

  @Column({ name: 'screening_id', type: 'uuid', nullable: true })
  screeningId: string;

  @ManyToOne(() => AiAnalysis, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ai_analysis_id' })
  aiAnalysis: AiAnalysis;

  @Column({ name: 'ai_analysis_id', type: 'uuid', nullable: true })
  aiAnalysisId: string;

  @Column({ name: 'medical_record_id', type: 'uuid', nullable: true })
  medicalRecordId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Doctor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string;

  // ============================================
  // SO SÁNH VỚI KẾT QUẢ AI (AI Comparison)
  // ============================================

  @Column({ name: 'agrees_with_ai', nullable: true })
  agreesWithAi: boolean;

  @Column({ name: 'ai_agreement_notes', type: 'text', nullable: true })
  aiAgreementNotes: string;

  @Column({ name: 'ai_confidence_vs_doctor', type: 'text', nullable: true })
  aiConfidenceVsDoctor: string;

  @Column({
    name: 'decision_source',
    type: 'varchar',
    length: 30,
    nullable: true,
    comment: 'AI_ONLY, DOCTOR_ONLY, DOCTOR_REVIEWED_AI',
  })
  decisionSource: 'AI_ONLY' | 'DOCTOR_ONLY' | 'DOCTOR_REVIEWED_AI';

  @Column({ name: 'doctor_override_reason', type: 'text', nullable: true })
  doctorOverrideReason: string;

  @Column({
    name: 'ai_confidence_at_decision',
    type: 'decimal',
    precision: 5,
    scale: 4,
    nullable: true,
  })
  aiConfidenceAtDecision: number;

  @Column({
    name: 'reviewed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  reviewedAt: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
