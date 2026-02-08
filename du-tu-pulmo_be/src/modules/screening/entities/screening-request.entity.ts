import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { ScreeningTypeEnum } from '@/modules/common/enums/screening-type.enum';
import { ScreeningStatusEnum } from '@/modules/common/enums/screening-status.enum';
import { ScreeningPriorityEnum } from '@/modules/common/enums/screening-priority.enum';
import { MedicalImage } from '@/modules/screening/entities/medical-image.entity';
import { AiAnalysis } from '@/modules/screening/entities/ai-analysis.entity';
import { ScreeningConclusion } from '@/modules/screening/entities/screening-conclusion.entity';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';

@Entity('screening_requests')
export class ScreeningRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Index()
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => MedicalRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Index()
  @Column({ name: 'medical_record_id', type: 'uuid' })
  medicalRecordId: string;


  @ManyToOne(() => Doctor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploaded_by_doctor_id' })
  uploadedByDoctor: Doctor;

  @Index()
  @Column({ name: 'uploaded_by_doctor_id', type: 'uuid', nullable: true })
  uploadedByDoctorId: string;

  @Index({ unique: true })
  @Column({ name: 'screening_number', length: 50, unique: true })
  screeningNumber: string;

  @Column({
    name: 'screening_type',
    type: 'enum',
    enum: ScreeningTypeEnum,
    default: ScreeningTypeEnum.XRAY,
  })
  screeningType: ScreeningTypeEnum;

  @Column({
    type: 'enum',
    enum: ScreeningStatusEnum,
    default: ScreeningStatusEnum.UPLOADED,
  })
  status: ScreeningStatusEnum;

  @Column({
    type: 'enum',
    enum: ScreeningPriorityEnum,
    default: ScreeningPriorityEnum.NORMAL,
  })
  priority: ScreeningPriorityEnum;

  @ManyToOne(() => Doctor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigned_doctor_id' })
  assignedDoctor: Doctor;

  @Index()
  @Column({ name: 'assigned_doctor_id', type: 'uuid', nullable: true })
  assignedDoctorId: string;

  @Column({ name: 'reassign_count', type: 'integer', default: 0 })
  reassignCount: number;

  @Column({ name: 'reassign_history', type: 'jsonb', nullable: true })
  reassignHistory: { doctorId: string; reason: string; at: string }[];

  @Column({ name: 'requested_at', type: 'timestamptz', nullable: true })
  requestedAt: Date;

  @Column({ name: 'uploaded_at', type: 'timestamptz', nullable: true })
  uploadedAt: Date;

  @Column({ name: 'ai_started_at', type: 'timestamptz', nullable: true })
  aiStartedAt: Date;

  @Column({ name: 'ai_completed_at', type: 'timestamptz', nullable: true })
  aiCompletedAt: Date;

  @Column({ name: 'doctor_assigned_at', type: 'timestamptz', nullable: true })
  doctorAssignedAt: Date;

  @Column({ name: 'doctor_completed_at', type: 'timestamptz', nullable: true })
  doctorCompletedAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ name: 'cancelled_by', length: 20, nullable: true })
  cancelledBy: string;

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

  @OneToMany(() => MedicalImage, (img) => img.screening)
  images: MedicalImage[];

  @OneToMany(() => AiAnalysis, (analysis) => analysis.screening)
  aiAnalyses: AiAnalysis[];

  @OneToMany(() => ScreeningConclusion, (conclusion) => conclusion.screening)
  conclusions: ScreeningConclusion[];
}
