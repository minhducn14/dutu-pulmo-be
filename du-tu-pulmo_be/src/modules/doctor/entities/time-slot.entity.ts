import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { DoctorSchedule } from './doctor-schedule.entity';
import { Appointment } from '../../appointment/entities/appointment.entity';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';

@Entity('time_slots')
// Partial unique index: only check non-deleted records
@Index('uk_timeslot_doctor_start', ['doctorId', 'startTime'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('idx_timeslots_doctor_time', ['doctorId', 'startTime', 'isAvailable'], {
  where: '"deleted_at" IS NULL',
})
@Index('idx_timeslots_available', ['isAvailable', 'startTime'], {
  where: '"deleted_at" IS NULL',
})
@Check('chk_timeslot_time_range', '"start_time" < "end_time"')
@Check('chk_timeslot_capacity', '"capacity" > 0')
@Check(
  'chk_timeslot_booked_count',
  '"booked_count" >= 0 AND "booked_count" <= "capacity"',
)
@Check(
  'chk_timeslot_allowed_types_not_empty',
  'cardinality("allowed_appointment_types") > 0',
)
export class TimeSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  @ManyToOne(() => DoctorSchedule, (schedule) => schedule.timeSlots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule: DoctorSchedule;

  @Column({ name: 'schedule_id', type: 'uuid', nullable: true })
  scheduleId: string | null;

  @Column({
    name: 'allowed_appointment_types',
    type: 'enum',
    enum: AppointmentTypeEnum,
    enumName: 'appointment_type_enum',
    array: true,
    default: '{IN_CLINIC}',
  })
  allowedAppointmentTypes: AppointmentTypeEnum[];

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'integer', default: 1 })
  capacity: number;

  @Column({ name: 'booked_count', type: 'integer', default: 0 })
  bookedCount: number;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  // ========================================
  // AUDIT FIELDS
  // ========================================
  @Column({ name: 'deleted_by', type: 'uuid', nullable: true })
  deletedBy: string | null;

  @Column({ name: 'deletion_reason', type: 'text', nullable: true })
  deletionReason: string | null;

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
  deletedAt: Date | null;

  // ========================================
  // RELATIONS
  // ========================================

  @OneToMany(() => Appointment, (appointment) => appointment.timeSlot)
  appointments: Appointment[];
}

