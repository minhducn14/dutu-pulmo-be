import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

@Entity('audit_logs')
@Index(['tableName', 'createdAt'])
@Index(['userId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @Column({
    type: 'enum',
    enum: AuditActionEnum,
  })
  action: AuditActionEnum;

  @Column({ name: 'table_name', length: 50 })
  tableName: string;

  @Column({ name: 'record_id', type: 'uuid', nullable: true })
  recordId: string;

  @Column({ name: 'old_values', type: 'jsonb', nullable: true })
  oldValues: Record<string, any>;

  @Column({ name: 'new_values', type: 'jsonb', nullable: true })
  newValues: Record<string, any>;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string;

  @Column({ name: 'request_method', length: 10, nullable: true })
  requestMethod: string; // GET, POST, PUT, DELETE

  @Column({ name: 'request_url', type: 'text', nullable: true })
  requestUrl: string;

  @Column({ default: true })
  success: boolean;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
