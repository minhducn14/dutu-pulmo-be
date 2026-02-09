import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  DeleteDateColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { User } from '@/modules/user/entities/user.entity';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { AccountStatusEnum } from '@/modules/common/enums/account-status.enum';

@Entity('accounts')
@Index('idx_accounts_email_lower', { synchronize: false })
@Index(['email'])
@Index(['isVerified'])
@Index(['roles'])
@Index(['status'])
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({
    name: 'reset_password_token',
    type: 'varchar',
    length: 500,
    nullable: true,
    select: false,
  })
  resetPasswordToken: string | null;


  @Column({ 
    type: 'varchar', 
    length: 6, 
    nullable: true,
    select: false, 
    comment: 'OTP for password reset'
  })
  resetPasswordOtp?: string | null;

  @Column({ 
    type: 'timestamp', 
    nullable: true,
    comment: 'Reset password OTP expiration time'
  })
  resetPasswordOtpExpiry?: Date | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: AccountStatusEnum,
    default: AccountStatusEnum.ACTIVE,
  })
  status: AccountStatusEnum;

  @Column({ name: 'suspended_until', type: 'timestamptz', nullable: true })
  suspendedUntil?: Date;

  @Column({ name: 'suspension_reason', type: 'text', nullable: true })
  suspensionReason?: string;

  @Column({ name: 'suspended_by', type: 'uuid', nullable: true })
  suspendedBy?: string;

  @Column({
    name: 'verification_token',
    type: 'varchar',
    length: 500,
    nullable: true,
    select: false,
  })
  verificationToken: string | null;

  @Column({
    name: 'verification_expiry',
    type: 'timestamptz',
    nullable: true,
  })
  verificationExpiry: Date | null;

  @Column({
    name: 'verification_otp',
    type: 'varchar',
    length: 500,
    nullable: true,
    select: false,
  })
  verificationOtp: string | null;

  @Column({
    name: 'verification_otp_expiry',
    type: 'timestamptz',
    nullable: true,
  })
  verificationOtpExpiry: Date | null;

  @Column({
    name: 'verified_at',
    type: 'timestamptz',
    nullable: true,
  })
  verifiedAt: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt?: Date;

  @OneToOne(() => User, (user) => user.account, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: RoleEnum, array: true })
  roles: RoleEnum[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date;

  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy?: string;

  @Column({ name: 'delete_reason', type: 'text', nullable: true })
  deleteReason?: string;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail() {
    if (this.email) {
      this.email = this.email.toLowerCase().trim();
    }
  }
}
