import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { Account } from 'src/modules/account/entities/account.entity';
import { UserStatusEnum } from '../../common/enums/user-status.enum';
import { GenderEnum } from 'src/modules/common/enums/gender.enum';
import { Patient } from 'src/modules/patient/entities/patient.entity';
import { Doctor } from 'src/modules/doctor/entities/doctor.entity';

@Entity('users')
@Index(['status'])
@Index(['phone'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

@Column({ length: 20, nullable: true, unique: true })
  phone: string;

  @Column({ name: 'full_name', length: 100 })
  fullName: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({
    type: 'enum',
    enum: UserStatusEnum,
    default: UserStatusEnum.ACTIVE,
  })
  status: UserStatusEnum; // Profile/Business status

   // Địa chỉ
  @Column({ length: 100, nullable: true })
  province: string; // Tỉnh/Thành phố

  @Column({ length: 100, nullable: true })
  district: string; // Quận/Huyện

  @Column({ length: 100, nullable: true })
  ward: string; //  Phường/Xã

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true, unique: true, length: 20 })
  CCCD?: string;

  @Column({
    type: 'enum',
    enum: GenderEnum,
    nullable: true,
  })
  gender: GenderEnum;

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

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamptz',
    nullable: true,
  })
  deletedAt: Date;

  @OneToOne(() => Account, (account) => account.user)
  account: Account;

  @OneToOne(() => Patient, (patient) => patient.user, { nullable: true })
  patient: Patient | null;

  @OneToOne(() => Doctor, (doctor) => doctor.user, { nullable: true })
  doctor: Doctor | null;
}