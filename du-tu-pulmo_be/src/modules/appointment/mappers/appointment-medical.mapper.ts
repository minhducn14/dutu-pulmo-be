import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { DoctorResponseDto } from '@/modules/doctor/dto/doctor-response.dto';
import { PatientResponseDto } from '@/modules/patient/dto/patient-response.dto';
import {
  MedicalRecordResponseDto,
  VitalSignResponseDto,
  PrescriptionResponseDto,
  PrescriptionItemResponseDto,
} from '@/modules/medical/dto/medical-response.dto';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import { VitalSign } from '@/modules/medical/entities/vital-sign.entity';

export const mapMedicalRecordToDto = (
  record: MedicalRecord,
): MedicalRecordResponseDto => ({
  id: record.id,
  recordNumber: record.recordNumber,
  patientId: record.patientId ?? undefined,
  patient: record.patient
    ? PatientResponseDto.fromEntity(record.patient)
    : (null as unknown as PatientResponseDto),
  doctorId: record.doctorId ?? undefined,
  doctor: record.doctor
    ? DoctorResponseDto.fromEntity(record.doctor)
    : (null as unknown as DoctorResponseDto),
  appointmentId: record.appointmentId,
  appointment: record.appointment
    ? AppointmentResponseDto.fromEntity(record.appointment)
    : undefined,
  chiefComplaint: record.chiefComplaint ?? undefined,
  presentIllnessHistory: record.presentIllness ?? undefined,
  pastMedicalHistory: record.medicalHistory ?? undefined,
  physicalExamNotes: record.physicalExamNotes ?? undefined,
  assessment: record.assessment ?? undefined,
  diagnosisNotes: record.diagnosisNotes ?? undefined,
  treatmentPlan: record.treatmentPlan ?? undefined,
  status: record.appointment?.status ?? 'UNKNOWN',
  progressNotes: record.progressNotes ?? undefined,
  followUpInstructions: record.followUpInstructions ?? undefined,
  surgicalHistory: record.surgicalHistory ?? undefined,
  familyHistory: record.familyHistory ?? undefined,
  allergies: record.allergies ?? undefined,
  chronicDiseases: record.chronicDiseases ?? undefined,
  currentMedications: record.currentMedications ?? undefined,
  smokingStatus: record.smokingStatus,
  smokingYears: record.smokingYears ?? undefined,
  alcoholConsumption: record.alcoholConsumption,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const mapPrescriptionToDto = (
  prescription: Prescription,
): PrescriptionResponseDto => {
  const items: PrescriptionItemResponseDto[] =
    prescription.items?.map((item) => ({
      id: item.id,
      medicineId: item.medicineId ?? undefined,
      medicineName: item.medicineName,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.durationDays ? `${item.durationDays} ngày` : '0 ngày',
      quantity: item.quantity,
      instructions: item.instructions ?? undefined,
      unit: item.unit,
    })) ?? [];

  return {
    id: prescription.id,
    prescriptionNumber: prescription.prescriptionNumber,
    patientId: prescription.patientId,
    doctorId: prescription.doctorId ?? undefined,
    medicalRecordId: prescription.medicalRecordId ?? undefined,
    appointmentId: prescription.appointmentId ?? undefined,
    diagnosis: undefined,
    notes: prescription.notes ?? undefined,
    status: prescription.status ?? undefined,
    items,
    createdAt: prescription.createdAt,
  };
};

export const mapVitalSignToDto = (vs: VitalSign): VitalSignResponseDto => ({
  id: vs.id,
  patientId: vs.patientId,
  medicalRecordId: vs.medicalRecordId ?? undefined,
  temperature: vs.temperature ? Number(vs.temperature) : undefined,
  bloodPressure: vs.bloodPressure ?? undefined,
  heartRate: vs.heartRate ? Number(vs.heartRate) : undefined,
  respiratoryRate: vs.respiratoryRate ? Number(vs.respiratoryRate) : undefined,
  spo2: vs.spo2 ? Number(vs.spo2) : undefined,
  height: vs.height ? Number(vs.height) : undefined,
  weight: vs.weight ? Number(vs.weight) : undefined,
  bmi: vs.bmi ? Number(vs.bmi) : undefined,
  notes: undefined,
  createdAt: vs.createdAt,
});
