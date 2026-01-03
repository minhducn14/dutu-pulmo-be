import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Check, Index
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';

@Entity('doctor_schedules')
@Index('idx_schedule_doctor_dow_type', ['doctorId', 'dayOfWeek', 'appointmentType'])
@Check('chk_schedule_day_of_week', '"day_of_week" >= 0 AND "day_of_week" <= 6')
@Check('chk_schedule_time_range', '"start_time" < "end_time"')
@Check(
  'chk_schedule_break_pair',
  `("break_start_time" IS NULL AND "break_end_time" IS NULL)
   OR ("break_start_time" IS NOT NULL AND "break_end_time" IS NOT NULL)`
)
@Check(
  'chk_schedule_break_in_range',
  `"break_start_time" IS NULL OR ("break_start_time" >= "start_time" AND "break_end_time" <= "end_time" AND "break_start_time" < "break_end_time")`
)
@Check('chk_schedule_slot_duration', '"slot_duration" > 0')
@Check('chk_schedule_slot_capacity', '"slot_capacity" > 0')
@Check('chk_schedule_min_booking_time', '"minimum_booking_time" >= 0')
@Check(
  'chk_schedule_effective_range',
  `"effective_from" IS NULL OR "effective_until" IS NULL OR "effective_from" <= "effective_until"`
)
@Check(
  'chk_schedule_inclinic_requires_hospital',
  `"appointment_type" <> 'IN_CLINIC' OR "hospital_id" IS NOT NULL`
)
export class DoctorSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, (doctor) => doctor.schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  @Column({ name: 'day_of_week', type: 'integer' }) // 0=CN, 1=T2...
  dayOfWeek: number;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ name: 'break_start_time', type: 'time', nullable: true })
  breakStartTime: string | null;

  @Column({ name: 'break_end_time', type: 'time', nullable: true })
  breakEndTime: string | null;

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

  @Column({ name: 'hospital_id', type: 'uuid', nullable: true })
  hospitalId: string | null;

  @Column({ name: 'minimum_booking_time', type: 'integer', default: 60 })
  minimumBookingTime: number;

  @Column({ name: 'max_advance_booking_days', type: 'integer', default: 30 })
  maxAdvanceBookingDays: number;

  @Column({ name: 'consultation_fee', type: 'decimal', precision: 10, scale: 2, nullable: true })
  consultationFee: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @Column({ name: 'effective_from', type: 'date', nullable: true })
  effectiveFrom: Date | null;

  @Column({ name: 'effective_until', type: 'date', nullable: true })
  effectiveUntil: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
