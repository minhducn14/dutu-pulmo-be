import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { Appointment } from '../../appointment/entities/appointment.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  @Column({ name: 'reviewer_id', type: 'uuid' })
  reviewerId: string;

  @ManyToOne(() => Doctor, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'decimal', precision: 2, scale: 1 })
  rating: number;

  @Column({ name: 'doctor_response', type: 'text', nullable: true })
  doctorResponse: string;

  @Column({ name: 'response_at', type: 'timestamptz', nullable: true })
  responseAt: Date;

  @Column({ name: 'is_anonymous', default: false })
  isAnonymous: boolean;

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
