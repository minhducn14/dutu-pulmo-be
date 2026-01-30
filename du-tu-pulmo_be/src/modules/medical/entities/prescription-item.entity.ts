import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import { Medicine } from '@/modules/medical/entities/medicine.entity';

@Entity('prescription_items')
export class PrescriptionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Prescription, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ name: 'prescription_id', type: 'uuid' })
  prescriptionId: string;

  @Column({ name: 'medicine_name', length: 255 })
  medicineName: string;

  @Column({ name: 'medicine_id', type: 'uuid', nullable: true })
  medicineId: string;

  @ManyToOne(() => Medicine)
  @JoinColumn({ name: 'medicine_id' })
  medicine: Medicine;

  @Column({ length: 100 })
  dosage: string; // "500mg"

  @Column({ length: 100 })
  frequency: string; // "3 lần/ngày"

  @Column({ name: 'duration_days', type: 'integer' })
  durationDays: number;

  @Column({ type: 'text', nullable: true })
  instructions: string; // "uống sau ăn"

  // @Column({ type: 'text', nullable: true })
  // notes: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ length: 50, nullable: true })
  unit: string; // viên, ml, gói...

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  @Column({ name: 'is_filled', default: false })
  isFilled: boolean;
}
