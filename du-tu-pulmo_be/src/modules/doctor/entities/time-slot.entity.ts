import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  Check,
} from 'typeorm';
import { Doctor } from './doctor.entity';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';

@Entity('time_slots')
@Unique('uk_timeslot_doctor_start', ['doctorId', 'startTime'])
@Index('idx_timeslots_doctor_time', ['doctorId', 'startTime', 'isAvailable'])
@Index('idx_timeslots_available', ['isAvailable', 'startTime'])
@Index('idx_timeslots_location', ['locationHospitalId', 'startTime'])
@Check('chk_timeslot_time_range', '"start_time" < "end_time"')
@Check('chk_timeslot_capacity', '"capacity" > 0')
@Check('chk_timeslot_booked_count', '"booked_count" >= 0 AND "booked_count" <= "capacity"')
@Check(
  'chk_timeslot_inclinic_requires_hospital',
  `NOT ('IN_CLINIC' = ANY("allowed_appointment_types")) OR "location_hospital_id" IS NOT NULL`
)
@Check('chk_timeslot_allowed_types_not_empty', 'cardinality("allowed_appointment_types") > 0')
export class TimeSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Doctor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId: string;

  // Nơi khám (nếu có offline). Online-only thì có thể null.
  @Column({ name: 'location_hospital_id', type: 'uuid', nullable: true })
  locationHospitalId: string | null;

  @Column({
    name: 'allowed_appointment_types',
    type: 'enum',
    enum: AppointmentTypeEnum,
    enumName: 'appointment_type_enum',
    array: true,
    default: '{IN_CLINIC}'
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

  // @OneToMany(() => Appointment, ap => ap.timeSlot)
  // appointments: Appointment[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}