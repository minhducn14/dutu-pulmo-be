import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AuditEntityType } from '../enums/audit-entity-type.enum';
import { AuditActorRole } from '../enums/audit-actor-role.enum';
import { AuditAction } from '../enums/audit-action.enum';
import { MedicalRecord } from './medical-record.entity';

@Entity('medical_record_audit_logs')
@Index(['patientId', 'createdAt'])
@Index(['medicalRecordId', 'createdAt'])
@Index(['entityId', 'createdAt'])
@Index(['createdAt'])
export class MedicalRecordAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    name: 'entity_type',
    type: 'enum',
    enum: AuditEntityType,
  })
  entityType: AuditEntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column({ name: 'medical_record_id', type: 'uuid', nullable: true })
  medicalRecordId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({
    name: 'actor_role',
    type: 'enum',
    enum: AuditActorRole,
  })
  actorRole: AuditActorRole;

  @Column({
    type: 'enum',
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @ManyToOne(() => MedicalRecord, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'medical_record_id' })
  medicalRecord?: MedicalRecord;
}
