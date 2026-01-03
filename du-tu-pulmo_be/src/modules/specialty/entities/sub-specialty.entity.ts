import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Specialty } from './specialty.entity';

@Entity('sub_specialties')
@Index(['name'])
@Index(['specialtyId'])
export class SubSpecialty {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string; // VD: "COPD", "Hen phế quản", "Lao phổi"

  @Column({ length: 255, nullable: true })
  description: string;

  @Column({ name: 'icon_url', length: 500, nullable: true })
  iconUrl: string;

  @Column({ name: 'specialty_id', type: 'uuid', nullable: true })
  specialtyId: string;

  @ManyToOne(() => Specialty, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'specialty_id' })
  specialty: Specialty;

  @Column({ name: 'display_order', type: 'integer', default: 0 })
  displayOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

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
