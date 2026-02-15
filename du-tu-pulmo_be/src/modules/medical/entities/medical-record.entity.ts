import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { VitalSign } from '@/modules/medical/entities/vital-sign.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
// Removed CareLog and LabResult imports
import { MedicalRecordStatusEnum } from '@/modules/common/enums/medical-record-status.enum';
import { ScreeningRequest } from '@/modules/screening/entities/screening-request.entity';

@Entity('medical_records')
@Index('ux_medical_record_appointment', ['appointmentId'], { unique: true })
export class MedicalRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @OneToOne(() => Appointment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id', type: 'uuid' })
  appointmentId: string;

  @ManyToOne(() => Doctor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @Column({ name: 'record_number', length: 50, unique: true })
  recordNumber: string;

  // ===== SIGNING FIELDS =====
  @Column({ name: 'signed_status', type: 'varchar', default: 'NOT_SIGNED' })
  signedStatus: string; // 'NOT_SIGNED' | 'SIGNED'

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @Column({ name: 'digital_signature', type: 'text', nullable: true })
  digitalSignature: string | null;

  @Column({ name: 'pdf_url', type: 'varchar', nullable: true })
  pdfUrl: string | null;

  // ===== ADMINISTRATIVE FIELDS =====
  @Column({
    name: 'record_type',
    type: 'varchar',
    default: 'Bệnh án Ngoại trú chung',
  })
  recordType: string;



  // ===== MEDICAL FIELDS =====
  // Lý do khám
  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string | null;

  @Column({ name: 'present_illness', type: 'text', nullable: true })
  presentIllness: string | null;

  // Lịch sử bệnh
  @Column({ name: 'medical_history', type: 'text', nullable: true })
  medicalHistory: string | null;

  @Column({ name: 'surgical_history', type: 'text', nullable: true })
  surgicalHistory: string | null;

  @Column({ name: 'family_history', type: 'text', nullable: true })
  familyHistory: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  allergies: string[] | null;

  @Column({
    name: 'chronic_diseases',
    type: 'text',
    array: true,
    nullable: true,
  })
  chronicDiseases: string[] | null;

  @Column({
    name: 'current_medications',
    type: 'text',
    array: true,
    nullable: true,
  })
  currentMedications: string[] | null;

  // Lifestyle
  @Column({ name: 'smoking_status', default: false })
  smokingStatus: boolean;

  @Column({ name: 'smoking_years', type: 'integer', nullable: true })
  smokingYears: number | null;

  @Column({ name: 'alcohol_consumption', default: false })
  alcoholConsumption: boolean;

  // Kết quả khám
  @Column({ name: 'physical_exam_notes', type: 'text', nullable: true })
  physicalExamNotes: string | null;

  @Column({ type: 'text', nullable: true })
  assessment: string | null; // Bác sĩ đánh giá

  @Column({ name: 'diagnosis_notes', type: 'text', nullable: true })
  diagnosis: string | null; // Chẩn đoán

  @Column({ name: 'treatment_plan', type: 'text', nullable: true })
  treatmentPlan: string | null; // Phác đồ điều trị

  // ===== EXTENDED MEDICAL FIELDS =====
  @Column({ name: 'systems_review', type: 'text', nullable: true })
  systemsReview: string | null;



  @Column({ name: 'treatment_given', type: 'text', nullable: true })
  treatmentGiven: string | null;

  @Column({ name: 'discharge_diagnosis', type: 'text', nullable: true })
  dischargeDiagnosis: string | null;

  @Column({ name: 'treatment_start_date', type: 'timestamptz', nullable: true })
  treatmentStartDate: Date | null;

  @Column({ name: 'treatment_end_date', type: 'timestamptz', nullable: true })
  treatmentEndDate: Date | null;

  // ===== SUMMARY FIELDS =====
  @Column({ name: 'progress_notes', type: 'text', nullable: true })
  progressNotes: string | null;



  @Column({ name: 'primary_diagnosis', type: 'text', nullable: true })
  primaryDiagnosis: string | null;

  @Column({ name: 'secondary_diagnosis', type: 'text', nullable: true })
  secondaryDiagnosis: string | null;

  @Column({ name: 'discharge_condition', type: 'text', nullable: true })
  dischargeCondition: string | null;

  @Column({ name: 'follow_up_instructions', type: 'text', nullable: true })
  followUpInstructions: string | null;

  @Column({ name: 'full_record_summary', type: 'text', nullable: true })
  fullRecordSummary: string | null;

  // Related records
  @ManyToOne(() => MedicalRecord, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'related_record_id' })
  relatedRecord: MedicalRecord | null;

  @Column({ name: 'related_record_id', type: 'uuid', nullable: true })
  relatedRecordId: string | null;

  @Column({
    type: 'enum',
    enum: MedicalRecordStatusEnum,
    default: MedicalRecordStatusEnum.DRAFT,
  })
  status: MedicalRecordStatusEnum;

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
  @OneToMany(() => VitalSign, (vs) => vs.medicalRecord)
  vitalSigns: VitalSign[];

  @OneToMany(() => Prescription, (p) => p.medicalRecord)
  prescriptions: Prescription[];

  @OneToMany(() => ScreeningRequest, (s) => s.medicalRecord)
  screeningRequests: ScreeningRequest[];
}
