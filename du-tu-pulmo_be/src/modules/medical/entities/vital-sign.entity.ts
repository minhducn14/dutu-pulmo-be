import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { Expose } from 'class-transformer';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';

@Entity('vital_signs')
export class VitalSign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => MedicalRecord, (mr) => mr.vitalSigns, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord: MedicalRecord;

  @Column({ name: 'medical_record_id', type: 'uuid', nullable: true })
  medicalRecordId: string;

  @Column({ name: 'height', type: 'integer', nullable: true })
  height: number;

  @Column({ name: 'weight', type: 'integer', nullable: true })
  weight: number;

  @Column({
    name: 'temperature',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  temperature: number;

  @Column({ name: 'blood_pressure', length: 20, nullable: true })
  bloodPressure: string;

  @Column({ name: 'heart_rate', type: 'integer', nullable: true })
  heartRate: number;

  @Column({ name: 'respiratory_rate', type: 'integer', nullable: true })
  respiratoryRate: number;

  @Column({ name: 'spo2', type: 'integer', nullable: true })
  spo2: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @Expose()
  get bmi(): number {
    if (!this.height || !this.weight) return 0;
    const heightInMeters = this.height / 100;
    return Number((this.weight / (heightInMeters * heightInMeters)).toFixed(2));
  }
}
