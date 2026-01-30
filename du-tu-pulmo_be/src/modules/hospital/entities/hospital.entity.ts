import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { FacilityTypeEnum } from '@/modules/common/enums/facility-type.enum';

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

  @Column({
    name: 'facility_type',
    type: 'enum',
    enum: FacilityTypeEnum,
    default: FacilityTypeEnum.HOSPITAL,
  })
  facilityType: FacilityTypeEnum;

  // Logo
  @Column({
    name: 'logo_url',
    nullable: true,
    default: 'https://picsum.photos/800/600',
  })
  logoUrl: string;

  // ===== ĐỊA CHỈ =====
  @Column({ type: 'text' })
  address: string;

  @Column({ length: 20, nullable: true })
  provinceCode: string;

  @Column({ length: 100, nullable: true })
  province: string; // Tỉnh/Thành phố

  @Column({ length: 20, nullable: true })
  wardCode: string;

  @Column({ length: 100, nullable: true })
  ward: string; //  Phường/Xã

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
