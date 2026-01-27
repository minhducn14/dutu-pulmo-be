import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToOne,
} from 'typeorm';
import { Patient } from '../../patient/entities/patient.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { User } from '../../user/entities/user.entity';
import { Hospital } from '../../hospital/entities/hospital.entity';
import { TimeSlot } from '../../doctor/entities/time-slot.entity';
import { AppointmentTypeEnum } from '../../common/enums/appointment-type.enum';
import { AppointmentStatusEnum } from '../../common/enums/appointment-status.enum';
import { AppointmentSubTypeEnum } from '../../common/enums/appointment-sub-type.enum';
import { SourceTypeEnum } from '../../common/enums/source-type.enum';

@Entity('appointments')
@Index('idx_appointment_patient_slot', ['patientId', 'timeSlotId'])
@Index('idx_appointment_patient_scheduled', ['patientId', 'scheduledAt'])
@Index('idx_appointment_doctor_scheduled', ['doctorId', 'scheduledAt'])
@Index('idx_appointment_status', ['status'])
@Index('idx_appointment_type_status', ['appointmentType', 'status'])
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'appointment_number', length: 50, unique: true })
  appointmentNumber: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Doctor, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: Doctor;

  @Column({ name: 'doctor_id', type: 'uuid', nullable: true })
  doctorId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'booked_by_user_id' })
  bookedByUser: User;

  @Column({ name: 'booked_by_user_id', type: 'uuid', nullable: true })
  bookedByUserId: string;

  // Hospital relation
  @ManyToOne(() => Hospital, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @Column({ name: 'hospital_id', type: 'uuid', nullable: true })
  hospitalId: string;

  @Column({ name: 'screening_id', type: 'uuid', nullable: true })
  screeningId: string;

  @ManyToOne(() => TimeSlot, (timeSlot) => timeSlot.appointments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'time_slot_id' })
  timeSlot: TimeSlot;

  @Column({ name: 'time_slot_id', type: 'uuid', nullable: true })
  timeSlotId: string;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ name: 'duration_minutes', type: 'integer', default: 30 })
  durationMinutes: number;

  @Column({ length: 50, default: 'Asia/Ho_Chi_Minh' })
  timezone: string;

  @Column({
    type: 'enum',
    enum: AppointmentStatusEnum,
    default: AppointmentStatusEnum.PENDING_PAYMENT,
  })
  status: AppointmentStatusEnum;

  @Column({
    name: 'appointment_type',
    type: 'enum',
    enum: AppointmentTypeEnum,
    default: AppointmentTypeEnum.IN_CLINIC,
  })
  appointmentType: AppointmentTypeEnum;

  @Column({
    name: 'sub_type',
    type: 'enum',
    enum: AppointmentSubTypeEnum,
    default: AppointmentSubTypeEnum.SCHEDULED,
  })
  subType: AppointmentSubTypeEnum;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: SourceTypeEnum,
    default: SourceTypeEnum.EXTERNAL,
  })
  sourceType: SourceTypeEnum;

  @Column({
    name: 'fee_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  feeAmount: string;

  @Column({
    name: 'paid_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  paidAmount: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string;

  @Column({ default: false })
  refunded: boolean;

  @Column({ name: 'refund_amount', type: 'bigint', nullable: true })
  refundAmount: string;

  @Column({ name: 'refund_status', length: 20, nullable: true })
  refundStatus: string;

  // ========================================
  // VIDEO CALL FIELDS
  // ========================================
  @Column({ name: 'meeting_room_id', length: 100, nullable: true })
  meetingRoomId: string;

  @Column({ name: 'meeting_url', type: 'text', nullable: true })
  meetingUrl: string;

  @Column({ name: 'meeting_password', length: 50, nullable: true })
  meetingPassword: string;

  @Column({ name: 'recording_url', type: 'text', nullable: true })
  recordingUrl: string;

  @Column({ name: 'recording_consent', default: false })
  recordingConsent: boolean;

  @Column({ name: 'daily_co_token', type: 'text', nullable: true })
  dailyCoToken: string;

  @Column({ name: 'daily_co_channel', length: 100, nullable: true })
  dailyCoChannel: string;

  @Column({ name: 'daily_co_uid', type: 'integer', nullable: true })
  dailyCoUid: number;

  // ========================================
  // IN_CLINIC FIELDS
  // ========================================
  // @Column({ name: 'room_number', length: 20, nullable: true })
  // roomNumber: string;

  @Column({ name: 'queue_number', type: 'integer', nullable: true })
  queueNumber: number;

  // @Column({ name: 'floor', length: 10, nullable: true })
  // floor: string;

  // ========================================
  // CLINICAL INFO ( Thông tin y tế)
  // ========================================
  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string; // Lý do thăm khám

  @Column({ type: 'text', array: true, nullable: true })
  symptoms: string[]; // triệu chứng

  @Column({ name: 'patient_notes', type: 'text', nullable: true })
  patientNotes: string; // Bệnh nhân ghi chú

  /**
   * @deprecated Use MedicalRecord.assessment instead. Kept for backward compatibility.
   */
  @Column({ name: 'doctor_notes', type: 'text', nullable: true })
  doctorNotes: string; // Bác sĩ ghi chú

  /**
   * @deprecated Use MedicalRecord.diagnosisNotes instead. Kept for backward compatibility.
   */
  @Column({ name: 'clinical_notes', type: 'text', nullable: true })
  clinicalNotes: string; // triệu chứng lâm sàng

  // ========================================
  // FOLLOW-UP
  // ========================================
  @Column({ name: 'follow_up_required', default: false })
  followUpRequired: boolean;

  @Column({
    name: 'next_appointment_date',
    type: 'timestamptz',
    nullable: true,
  })
  nextAppointmentDate: Date;

  @Column({ name: 'has_follow_up', default: false })
  hasFollowUp: boolean;

  @OneToOne(() => Appointment)
  @JoinColumn({ name: 'follow_up_appointment_id' })
  followUpAppointment: Appointment;

  @Column({ name: 'follow_up_appointment_id', type: 'uuid', nullable: true })
  followUpAppointmentId: string;

  // ========================================
  // REMINDERS
  // ========================================
  @Column({ name: 'reminder_24h_sent', default: false })
  reminder24hSent: boolean;

  @Column({ name: 'reminder_1h_sent', default: false })
  reminder1hSent: boolean;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt: Date;

  @Column({ name: 'confirmation_sent', default: false })
  confirmationSent: boolean;

  // ========================================
  // TIMELINE
  // ========================================
  @Column({ name: 'check_in_time', type: 'timestamptz', nullable: true })
  checkInTime: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date;

  // ========================================
  // CANCELLATION
  // ========================================
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ name: 'cancelled_by', length: 20, nullable: true })
  cancelledBy: string;

  // ========================================
  // RATING
  // ========================================
  @Column({ name: 'patient_rating', type: 'integer', nullable: true })
  patientRating: number;

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
