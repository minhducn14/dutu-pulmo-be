import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMeta } from 'src/common/dto/pagination.dto';
import { AppointmentResponseDto } from 'src/modules/appointment/dto/appointment-response.dto';
import { DoctorResponseDto } from 'src/modules/doctor/dto/doctor-response.dto';
import { PatientResponseDto } from 'src/modules/patient/dto/patient-response.dto';

// ============================================================================
// MEDICAL RECORD RESPONSE DTOs
// ============================================================================

export class MedicalRecordResponseDto {
  @ApiProperty({ description: 'Medical Record ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Record number (mã hồ sơ)' })
  recordNumber: string;

  @ApiProperty({ description: 'Patient ID' })
  patientId: string;

  @ApiProperty({ description: 'Patient' })
  patient: PatientResponseDto;

  @ApiPropertyOptional({ description: 'Doctor ID' })
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Doctor' })
  doctor: DoctorResponseDto;

  @ApiPropertyOptional({ description: 'Appointment ID' })
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'Appointment' })
  appointment?: AppointmentResponseDto;

  @ApiPropertyOptional({ description: 'Chief complaint (lý do khám)' })
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Present illness history' })
  presentIllnessHistory?: string;

  @ApiPropertyOptional({ description: 'Past medical history' })
  pastMedicalHistory?: string;

  @ApiPropertyOptional({
    description: 'Physical exam notes (ghi chú khám lâm sàng)',
  })
  physicalExamNotes?: string;

  @ApiPropertyOptional({ description: 'Assessment (nhận xét, đánh giá)' })
  assessment?: string;

  @ApiPropertyOptional({ description: 'Diagnosis notes (chẩn đoán)' })
  diagnosisNotes?: string;

  @ApiPropertyOptional({ description: 'Treatment plan (kế hoạch điều trị)' })
  treatmentPlan?: string;

  @ApiProperty({ description: 'Record status' })
  status: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}

// ============================================================================
// VITAL SIGN RESPONSE DTOs
// ============================================================================

export class VitalSignResponseDto {
  @ApiProperty({ description: 'Vital Sign ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Patient ID' })
  patientId: string;

  @ApiPropertyOptional({ description: 'Medical Record ID' })
  medicalRecordId?: string;

  @ApiPropertyOptional({ description: 'Temperature (°C)' })
  temperature?: number;

  @ApiPropertyOptional({ description: 'Blood pressure (e.g. "120/80")' })
  bloodPressure?: string;

  @ApiPropertyOptional({ description: 'Heart rate (bpm)' })
  heartRate?: number;

  @ApiPropertyOptional({ description: 'Respiratory rate (breaths/min)' })
  respiratoryRate?: number;

  @ApiPropertyOptional({ description: 'SpO2 (%)' })
  spo2?: number;

  @ApiPropertyOptional({ description: 'Height (cm)' })
  height?: number;

  @ApiPropertyOptional({ description: 'Weight (kg)' })
  weight?: number;

  @ApiPropertyOptional({ description: 'BMI (auto-calculated)' })
  bmi?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;

  @ApiProperty({ description: 'Recorded at' })
  createdAt: Date;
}

// ============================================================================
// PRESCRIPTION RESPONSE DTOs
// ============================================================================

export class PrescriptionItemResponseDto {
  @ApiProperty({ description: 'Item ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Medicine ID' })
  medicineId?: string;

  @ApiPropertyOptional({ description: 'Medicine name' })
  medicineName?: string;

  @ApiProperty({ description: 'Dosage' })
  dosage: string;

  @ApiProperty({ description: 'Frequency' })
  frequency: string;

  @ApiProperty({ description: 'Duration' })
  duration: string;

  @ApiPropertyOptional({ description: 'Quantity' })
  quantity?: number;

  @ApiPropertyOptional({ description: 'Instructions' })
  instructions?: string;

  @ApiProperty({ description: 'Unit' })
  unit: string;
}

export class PrescriptionResponseDto {
  @ApiProperty({ description: 'Prescription ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Prescription number (mã đơn thuốc)' })
  prescriptionNumber: string;

  @ApiProperty({ description: 'Patient ID' })
  patientId: string;

  @ApiPropertyOptional({ description: 'Doctor ID' })
  doctorId?: string;

  @ApiPropertyOptional({ description: 'Medical Record ID' })
  medicalRecordId?: string;

  @ApiPropertyOptional({ description: 'Appointment ID' })
  appointmentId?: string;

  @ApiPropertyOptional({ description: 'Diagnosis' })
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Notes' })
  notes?: string;

  @ApiProperty({ description: 'Status' })
  status: string;

  @ApiProperty({
    type: [PrescriptionItemResponseDto],
    description: 'Prescription items',
  })
  items: PrescriptionItemResponseDto[];

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;
}

// ============================================================================
// MEDICINE RESPONSE DTOs
// ============================================================================

export class MedicineResponseDto {
  @ApiProperty({ description: 'Medicine ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Medicine code' })
  code: string;

  @ApiProperty({ description: 'Medicine name' })
  name: string;

  @ApiPropertyOptional({ description: 'Generic name (tên hoạt chất)' })
  genericName?: string;

  @ApiPropertyOptional({ description: 'Manufacturer' })
  manufacturer?: string;

  @ApiPropertyOptional({ description: 'Dosage form (viên, ống, chai...)' })
  packing?: string;

  @ApiPropertyOptional({ description: 'Strength (hàm lượng)' })
  strength?: string;

  @ApiPropertyOptional({ description: 'Unit (viên, ml, mg...)' })
  unit?: string;

  @ApiPropertyOptional({ description: 'Category' })
  category?: string;

  @ApiPropertyOptional({ description: 'Description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Price' })
  price?: number;

  @ApiProperty({ description: 'Is active' })
  isActive: boolean;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}

export class PaginatedMedicineResponseDto {
  @ApiProperty({ type: [MedicineResponseDto] })
  items: MedicineResponseDto[];

  @ApiProperty({ type: PaginationMeta })
  meta: PaginationMeta;
}
