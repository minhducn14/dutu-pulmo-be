import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Doctor } from '../../doctor/entities/doctor.entity';

@Entity('specialties')
@Index(['name'], { unique: true })
export class Specialty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string; // VD: "Nội tổng quát", "Hô hấp", "Tim mạch"

  @Column({ length: 255, nullable: true })
  description: string;

  @Column({ name: 'icon_url', length: 500, nullable: true })
  iconUrl: string; // Icon cho chuyên khoa

  @Column({ name: 'image_url', length: 500, nullable: true })
  imageUrl: string; // Ảnh đại diện

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number; // Thứ tự hiển thị

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null; // Chuyên khoa cha (nếu là sub-specialty)

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

  // Relations
  @OneToMany(() => Doctor, (doctor) => doctor.specialty)
  doctors: Doctor[];
}
