import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  DeleteDateColumn,
  OneToOne,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { VerificationStatus } from 'src/modules/common/enums/doctor-verification-status.enum';

@Entity('doctors')
@Index(['verificationStatus'])
@Index(['specialtyId'])
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

  @Column({ length: 100, nullable: true })
  title: string; // Học hàm/học vị

  @Column({ length: 100, nullable: true })
  position: string; // Chức vụ

  @Column({ name: 'specialty_id', type: 'uuid', nullable: true })
  specialtyId: string; // Chuyên khoa

  @Column({ name: 'sub_specialties', type: 'text', array: true, nullable: true })
  subSpecialties: string[]; // Chuyên khám

  @Column({ name: 'years_of_experience', type: 'integer', nullable: true })
  yearsOfExperience: number;

  // Nơi công tác
  @Column({ name: 'primary_hospital_id', type: 'uuid', nullable: true })
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
  averageRating: number;

  @Column({ name: 'total_reviews', type: 'integer', default: 0 })
  totalReviews: number;

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
}
