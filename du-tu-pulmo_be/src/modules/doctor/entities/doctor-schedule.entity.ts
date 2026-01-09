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
  Check,
  Index,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { TimeSlot } from './time-slot.entity';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';
import { ScheduleType } from 'src/modules/common/enums/schedule-type.enum';

@Entity('doctor_schedules')
@Index(
  'idx_schedule_doctor_dow_type',
  ['doctorId', 'dayOfWeek', 'appointmentType'],
  {
    where: '"deleted_at" IS NULL',
  },
)
@Index('idx_schedule_priority', ['doctorId', 'priority', 'dayOfWeek'], {
  where: '"deleted_at" IS NULL',
})
@Index('idx_schedule_specific_date', ['doctorId', 'specificDate'], {
  where: '"deleted_at" IS NULL',
})
@Check('chk_schedule_day_of_week', '"day_of_week" >= 0 AND "day_of_week" <= 6')
@Check('chk_schedule_time_range', '"start_time" < "end_time"')
@Check('chk_schedule_slot_duration', '"slot_duration" > 0')
@Check('chk_schedule_slot_capacity', '"slot_capacity" > 0')
@Check('chk_schedule_min_booking_time', '"minimum_booking_time" >= 0')
@Check(
  'chk_schedule_effective_range',
  `"effective_from" IS NULL OR "effective_until" IS NULL OR "effective_from" <= "effective_until"`,
)
export class DoctorSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, (doctor) => doctor.schedules, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({
    name: 'schedule_type',
    type: 'enum',
    enum: ScheduleType,
    default: ScheduleType.REGULAR,
  })
  scheduleType: ScheduleType;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'day_of_week', type: 'integer' }) // 0=CN, 1=T2...
  dayOfWeek: number;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'slot_duration', type: 'integer', default: 30 })
  slotDuration: number;

  @Column({ name: 'slot_capacity', type: 'integer', default: 1 })
  slotCapacity: number;

  @Column({
    name: 'appointment_type',
    type: 'enum',
    enum: AppointmentTypeEnum,
    default: AppointmentTypeEnum.IN_CLINIC,
  })
  appointmentType: AppointmentTypeEnum;

  @Column({ name: 'minimum_booking_time', type: 'integer', default: 60 })
  minimumBookingTime: number;

  @Column({ name: 'max_advance_booking_days', type: 'integer', default: 30 })
  maxAdvanceBookingDays: number;

  @Column({
    name: 'consultation_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  consultationFee: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'effective_until', type: 'date', nullable: true })
  effectiveUntil: Date | null;

  @Column({ name: 'specific_date', type: 'date', nullable: true })
  specificDate: Date | null;

  @Column({ name: 'discount_percent', type: 'integer', default: 0 })
  discountPercent: number;

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

  @OneToMany(() => TimeSlot, (timeSlot) => timeSlot.schedule, {
    cascade: ['soft-remove'],
  })
  timeSlots: TimeSlot[];
}
