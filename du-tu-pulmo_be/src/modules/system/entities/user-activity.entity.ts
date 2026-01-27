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

@Entity('user_activities')
@Index(['userId', 'createdAt'])
@Index(['activityType', 'createdAt'])
export class UserActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string;

  @Column({ name: 'activity_type', length: 50 })
  activityType: string; // VIEW_DOCTOR, SEARCH, BOOK_APPOINTMENT...

  @Column({ name: 'activity_data', type: 'jsonb', nullable: true })
  activityData: Record<string, any>; // search filters, view params...

  @Column({ name: 'page_url', type: 'text', nullable: true })
  pageUrl: string;

  @Column({ type: 'text', nullable: true })
  referrer: string;

  @Column({ name: 'device_type', length: 50, nullable: true })
  deviceType: string; // mobile, desktop, tablet

  @Column({ length: 100, nullable: true })
  browser: string;

  @Column({ length: 50, nullable: true })
  os: string;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 100, nullable: true })
  country: string;

  @Column({ name: 'session_id', length: 100, nullable: true })
  sessionId: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
