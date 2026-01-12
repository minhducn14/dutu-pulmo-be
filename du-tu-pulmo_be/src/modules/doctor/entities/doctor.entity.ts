import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
  OneToMany,
  DeleteDateColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { SpecialtyEnum } from 'src/modules/common/enums/specialty.enum';
import { DoctorTitle } from 'src/modules/common/enums/doctor-title.enum';
import { VerificationStatus } from 'src/modules/common/enums/doctor-verification-status.enum';
import { DoctorSchedule } from './doctor-schedule.entity';
import { Hospital } from '../../hospital/entities/hospital.entity';

@Entity('doctors')
@Index(['verificationStatus'])
@Index(['specialty'])
@Index(['primaryHospitalId'])
export class Doctor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid', unique: true, nullable: false })
  userId: string;

  @Column({ name: 'practice_start_year', type: 'integer', nullable: true })
  practiceStartYear: number;

  // Chuyên môn
  @Column({ name: 'license_number', length: 100, unique: true })
  licenseNumber: string;

  @Column({ name: 'license_image_urls', type: 'jsonb', nullable: true })
  licenseImageUrls: { url: string; expiry?: string }[];

  @Column({
    type: 'enum',
    enum: DoctorTitle,
    nullable: true,
  })
  title: DoctorTitle; // Học hàm/học vị

  @Column({ length: 100, nullable: true })
  position: string; // Chức vụ

  @Column({
    type: 'enum',
    enum: SpecialtyEnum,
    nullable: true,
  })
  specialty: SpecialtyEnum;

  @Column({ name: 'years_of_experience', type: 'integer', nullable: true })
  yearsOfExperience: number;

  // Nơi công tác
  @ManyToOne(() => Hospital, (hospital) => hospital.doctors, {
    nullable: false,
  })
  @JoinColumn({ name: 'primary_hospital_id' })
  primaryHospital: Hospital;

  @Column({ name: 'primary_hospital_id', type: 'uuid', nullable: false })
  primaryHospitalId: string;

  // Mô tả trình độ chuyên môn
  @Column({ name: 'expertise_description', type: 'text', nullable: true })
  expertiseDescription: string;

  // Giới thiệu chi tiết
  @Column({ type: 'text', nullable: true })
  bio: string; // Giới thiệu

  @Column({ name: 'work_experience', type: 'text', nullable: true })
  workExperience: string; // Kinh nghiệm làm việc

  @Column({ type: 'text', nullable: true })
  education: string;

  @Column({ type: 'jsonb', nullable: true })
  certifications: { name: string; issuer: string; year: number }[];

  @Column({ name: 'awards_research', type: 'text', nullable: true })
  awardsResearch: string; // Giải thưởng/Công trình nghiên cứu

  // Đơn vị đào tạo
  @Column({ name: 'training_units', type: 'jsonb', nullable: true })
  trainingUnits: { url: string; name: string }[];

  // Rating
  @Column({
    name: 'average_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
  })
  averageRating: string;

  @Column({ name: 'total_reviews', type: 'integer', default: 0 })
  totalReviews: number;

  // Default consultation fee - used when schedule.consultationFee is null
  @Column({
    name: 'default_consultation_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  defaultConsultationFee: string | null;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus: VerificationStatus;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

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

  @OneToMany(() => DoctorSchedule, (ds) => ds.doctor)
  schedules: DoctorSchedule[];
}
