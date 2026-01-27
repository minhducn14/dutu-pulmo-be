import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { Appointment } from '../../appointment/entities/appointment.entity';

export enum ReportType {
  DOCTOR = 'doctor',
  APPOINTMENT = 'appointment',
  SYSTEM = 'system',
}

export enum ReportStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.reports, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @ManyToOne(() => Doctor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId: string;

  @Column({
    name: 'report_type',
    type: 'enum',
    enum: ReportType,
    default: ReportType.DOCTOR,
  })
  reportType: ReportType;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: ReportStatus,
    default: ReportStatus.PENDING,
  })
  status: ReportStatus;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;
}
