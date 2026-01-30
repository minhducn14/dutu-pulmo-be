import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AiAnalysis } from '@/modules/screening/entities/ai-analysis.entity';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { PrescriptionItem } from '@/modules/medical/entities/prescription-item.entity';
import { PrescriptionStatusEnum } from '@/modules/common/enums/prescription-status.enum';

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'prescription_number', length: 50, unique: true })
  prescriptionNumber: string;

  @ManyToOne(() => Appointment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string;

  @ManyToOne(() => AiAnalysis, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ai_diagnosis_id' })
  aiDiagnosis: AiAnalysis;

  @Column({ name: 'ai_diagnosis_id', type: 'uuid', nullable: true })
  aiDiagnosisId: string;

  @ManyToOne(() => MedicalRecord, (mr) => mr.prescriptions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

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

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: PrescriptionStatusEnum,
    default: PrescriptionStatusEnum.ACTIVE,
  })
  status: PrescriptionStatusEnum;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date;

  @Column({ name: 'pharmacy_id', type: 'uuid', nullable: true })
  pharmacyId: string;

  @Column({ name: 'filled_at', type: 'timestamptz', nullable: true })
  filledAt: Date;

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

  // Relations
  @OneToMany(() => PrescriptionItem, (item) => item.prescription)
  items: PrescriptionItem[];
}
