import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Doctor } from '../../doctor/entities/doctor.entity';

@Entity('hospitals')
export class Hospital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'hospital_code', length: 50, unique: true })
  hospitalCode: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  // ===== ĐỊA CHỈ =====
  @Column({ type: 'text' })
  address: string;

  // ===== TỌA ĐỘ (Optional - nếu cần map) =====
  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  // ===== RELATIONS =====
  @OneToMany(() => Doctor, (doctor) => doctor.primaryHospital)
  doctors: Doctor[];

  // ===== TIMESTAMPS =====
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date;

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
}
