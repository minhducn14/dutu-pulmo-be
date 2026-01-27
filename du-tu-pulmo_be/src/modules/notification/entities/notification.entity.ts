import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  Unique,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { NotificationTypeEnum } from '../../common/enums/notification-type.enum';
import { StatusEnum } from '../../common/enums/status.enum';

@Entity('notifications')
@Unique('uk_notification_idempotency', ['userId', 'type', 'refId'])
@Index('idx_notifications_user_status', ['userId', 'status'])
@Index('idx_notifications_unread', ['userId', 'status'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Add scalar userId for IDOR checks without loading relation
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationTypeEnum })
  type: NotificationTypeEnum;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ type: 'enum', enum: StatusEnum, default: StatusEnum.PENDING })
  status: StatusEnum;

  @Column({ name: 'ref_id', type: 'uuid', nullable: true })
  refId: string;

  @Column({ name: 'ref_type', length: 50, nullable: true })
  refType: string; // APPOINTMENT, SCREENING, PAYMENT, etc.

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
