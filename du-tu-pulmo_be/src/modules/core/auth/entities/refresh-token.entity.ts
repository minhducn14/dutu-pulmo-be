import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Account } from '../../../account/entities/account.entity';

@Entity('refresh_tokens')
@Index(['accountId'])
@Index(['token'])
@Index(['expiresAt'])
@Index(['isRevoked'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  token: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  // Device/session info
  @Column({ name: 'device_info', type: 'varchar', length: 255, nullable: true })
  deviceInfo?: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  // Token lifecycle
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked: boolean;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;

  @Column({ name: 'revoked_reason', type: 'varchar', length: 100, nullable: true })
  revokedReason?: string;

  // Rotation tracking
  @Column({ name: 'replaced_by_token_id', type: 'uuid', nullable: true })
  replacedByTokenId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date;
}
