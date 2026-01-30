import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';

export enum AdminActionType {
  // User management
  BAN_USER = 'BAN_USER',
  UNBAN_USER = 'UNBAN_USER',
  VERIFY_USER = 'VERIFY_USER',
  DELETE_USER = 'DELETE_USER',
  RESTORE_USER = 'RESTORE_USER',
  UPDATE_USER_ROLE = 'UPDATE_USER_ROLE',

  // Doctor management
  APPROVE_DOCTOR = 'APPROVE_DOCTOR',
  REJECT_DOCTOR = 'REJECT_DOCTOR',
  SUSPEND_DOCTOR = 'SUSPEND_DOCTOR',

  // Content moderation
  DELETE_CONTENT = 'DELETE_CONTENT',
  HIDE_CONTENT = 'HIDE_CONTENT',
  RESTORE_CONTENT = 'RESTORE_CONTENT',

  // Medical records
  VIEW_MEDICAL_RECORD = 'VIEW_MEDICAL_RECORD',
  EXPORT_MEDICAL_RECORD = 'EXPORT_MEDICAL_RECORD',

  // Screening
  OVERRIDE_AI_DIAGNOSIS = 'OVERRIDE_AI_DIAGNOSIS',
  APPROVE_SCREENING = 'APPROVE_SCREENING',

  // System
  SYSTEM_CONFIG_CHANGE = 'SYSTEM_CONFIG_CHANGE',
  BULK_OPERATION = 'BULK_OPERATION',

  // Correction/Void
  VOID_ACTION = 'VOID_ACTION',
  CORRECTION = 'CORRECTION',
}

@Entity('admin_actions')
@Index(['adminUserId', 'createdAt'])
@Index(['targetUserId', 'createdAt'])
@Index(['actionType', 'createdAt'])
@Index(['createdAt'])
export class AdminAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admin_user_id', type: 'uuid' })
  adminUserId: string;

  @Column({ name: 'admin_account_id', type: 'uuid', nullable: true })
  adminAccountId: string;

  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId: string;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: AdminActionType,
  })
  actionType: AdminActionType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ name: 'request_id', type: 'varchar', length: 36, nullable: true })
  requestId: string;

  @Column({
    name: 'resource_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  resourceType: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string;

  @Column({ name: 'is_voided', type: 'boolean', default: false })
  isVoided: boolean;

  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date;

  @Column({ name: 'voided_by_user_id', type: 'uuid', nullable: true })
  voidedByUserId: string;

  @Column({ name: 'void_reason', type: 'text', nullable: true })
  voidReason: string;

  @Column({ name: 'voids_action_id', type: 'uuid', nullable: true })
  voidsActionId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'admin_user_id' })
  adminUser?: User;

  @ManyToOne(() => User, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'target_user_id' })
  targetUser?: User;
}
