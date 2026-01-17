import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToOne,
  BeforeInsert,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'profile_code', length: 50, nullable: true })
  profileCode: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  // MEDICAL INFORMATION - CỰC KỲ QUAN TRỌNG
  @Column({ name: 'blood_type', length: 10, nullable: true })
  bloodType: string; // A+, B-, O+, AB+...

  // EMERGENCY CONTACT
  @Column({ name: 'emergency_contact_name', length: 100, nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_phone', length: 20, nullable: true })
  emergencyContactPhone: string;

  @Column({
    name: 'emergency_contact_relationship',
    length: 50,
    nullable: true,
  })
  emergencyContactRelationship: string;

  // INSURANCE
  @Column({ name: 'insurance_provider', length: 100, nullable: true })
  insuranceProvider: string;

  @Column({
    name: 'insurance_number',
    length: 50,
    nullable: true,
    unique: true,
  })
  insuranceNumber: string;

  @Column({ name: 'insurance_expiry', type: 'date', nullable: true })
  insuranceExpiry: Date;

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

  @BeforeInsert()
  generateProfileCode() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 12).toUpperCase();
    this.profileCode = `DTPM${year}${month}${day}${random}`;
  }
}
