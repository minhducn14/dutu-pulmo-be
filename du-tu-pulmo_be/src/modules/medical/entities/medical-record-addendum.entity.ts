import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MedicalRecord } from './medical-record.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { SignedStatusEnum } from '@/modules/common/enums/signed-status.enum';

@Entity('medical_record_addenda')
export class MedicalRecordAddendum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MedicalRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'original_record_id' })
  originalRecord: MedicalRecord;

  @Index('idx_addendum_original_record')
  @Column({ name: 'original_record_id', type: 'uuid' })
  originalRecordId: string;

  @ManyToOne(() => Doctor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string | null;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    name: 'signed_status',
    type: 'enum',
    enum: SignedStatusEnum,
    default: SignedStatusEnum.NOT_SIGNED,
  })
  signedStatus: SignedStatusEnum;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
