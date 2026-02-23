import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ScreeningRequestResponseDto } from '@/modules/screening/dto/screening-request-response.dto';

export enum SignedStatusEnum {
  NOT_SIGNED = 'NOT_SIGNED',
  SIGNED = 'SIGNED',
}

export class MedicalRecordDetailResponseDto {
  @ApiProperty({ description: 'Medical Record ID' })
  id: string;

  @ApiProperty({ description: 'Record number' })
  recordNumber: string | null;

  @ApiProperty({ description: 'Patient info' })
  patient: {
    id: string;
    fullName: string;
    gender: string;
    dateOfBirth: Date;
  };

  @ApiProperty({ description: 'Doctor info' })
  doctor: {
    id: string;
    fullName: string;
  };

  @ApiProperty({ description: 'Appointment info' })
  appointment: {
    id: string;
    appointmentNumber: string;
    status: string;
    scheduledAt: Date;
  };

  @ApiProperty({ enum: SignedStatusEnum })
  signedStatus: SignedStatusEnum;

  @ApiPropertyOptional({ description: 'Signed at timestamp' })
  signedAt?: Date;

  @ApiPropertyOptional({ description: 'Digital signature data' })
  @Transform(({ value }) => value ?? '')
  digitalSignature?: string;

  @ApiPropertyOptional({ description: 'Diagnosis' })
  @Transform(({ value }) => value ?? '')
  diagnosis?: string;

  // TAB 1: BỆNH ÁN
  @ApiProperty({ description: 'Loại bệnh án' })
  recordType: string;

  @ApiPropertyOptional({ description: 'Lý do vào viện' })
  @Transform(({ value }) => value ?? '')
  chiefComplaint?: string;

  @ApiProperty({ description: 'Chỉ số sinh hiệu' })
  vitalSigns: {
    temperature?: number;
    respiratoryRate?: number;
    weight?: number;
    bloodPressure?: string;
    heartRate?: number;
    height?: number;
    bmi?: number;
    spo2?: number;
  };

  @ApiPropertyOptional({ description: 'Quá trình bệnh lý' })
  @Transform(({ value }) => value ?? '')
  presentIllness?: string;

  @ApiPropertyOptional({ description: 'Tiền sử bản thân' })
  @Transform(({ value }) => value ?? '')
  medicalHistory?: string;

  @ApiPropertyOptional({ description: 'Tiền sử gia đình' })
  @Transform(({ value }) => value ?? '')
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Khám toàn thân' })
  @Transform(({ value }) => value ?? '')
  physicalExamNotes?: string;

  @ApiPropertyOptional({ description: 'Các bộ phận' })
  @Transform(({ value }) => value ?? '')
  systemsReview?: string;

  @ApiPropertyOptional({ description: 'Đã xử lý' })
  @Transform(({ value }) => value ?? '')
  treatmentGiven?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán khi ra viện' })
  @Transform(({ value }) => value ?? '')
  dischargeDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu điều trị' })
  treatmentStartDate?: Date;

  @ApiPropertyOptional({ description: 'Ngày kết thúc điều trị' })
  treatmentEndDate?: Date;

  // TAB 2: PHIẾU ĐIỀU TRỊ
  @ApiProperty({ description: 'Danh sách đơn thuốc', type: Array })
  prescriptions: Array<{
    id: string;
    prescriptionNumber: string;
    items: Array<{
      medicineName: string;
      quantity: number;
      unit: string;
      dosage: string;
      frequency: string;
      durationDays: number;
      instructions?: string;
      startDate?: Date;
      endDate?: Date;
    }>;
    notes?: string;
    createdAt: Date;
  }>;

  // TAB 3: TỔNG KẾT
  @ApiPropertyOptional({ description: 'Quá trình bệnh lý và diễn biến' })
  @Transform(({ value }) => value ?? '')
  progressNotes?: string;

  @ApiPropertyOptional({ description: 'Bệnh chính' })
  @Transform(({ value }) => value ?? '')
  primaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Bệnh kèm theo' })
  @Transform(({ value }) => value ?? '')
  secondaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Phương pháp điều trị' })
  @Transform(({ value }) => value ?? '')
  treatmentPlan?: string;

  @ApiPropertyOptional({ description: 'Tình trạng ra viện' })
  @Transform(({ value }) => value ?? '')
  dischargeCondition?: string;

  @ApiPropertyOptional({ description: 'Hướng điều trị tiếp theo' })
  @Transform(({ value }) => value ?? '')
  followUpInstructions?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt hồ sơ' })
  @Transform(({ value }) => value ?? '')
  fullRecordSummary?: string;

  @ApiPropertyOptional({ description: 'Assessment' })
  @Transform(({ value }) => value ?? '')
  assessment?: string;

  @ApiPropertyOptional({ description: 'Surgical history' })
  @Transform(({ value }) => value ?? '')
  surgicalHistory?: string;

  @ApiPropertyOptional({ description: 'Allergies' })
  @Transform(({ value }) => value ?? [])
  allergies?: string[];

  @ApiPropertyOptional({ description: 'Chronic diseases' })
  @Transform(({ value }) => value ?? [])
  chronicDiseases?: string[];

  @ApiPropertyOptional({ description: 'Current medications' })
  @Transform(({ value }) => value ?? [])
  currentMedications?: string[];

  @ApiPropertyOptional({ description: 'Smoking status' })
  smokingStatus?: boolean;

  @ApiPropertyOptional({ description: 'Smoking years' })
  smokingYears?: number;

  @ApiPropertyOptional({ description: 'Alcohol consumption' })
  alcoholConsumption?: boolean;

  @ApiProperty({ description: 'Status bệnh án' })
  status: string;

  @ApiProperty({ description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'PDF URL' })
  @Transform(({ value }) => value ?? '')
  pdfUrl?: string;

  @ApiPropertyOptional({ type: [ScreeningRequestResponseDto] })
  @Transform(({ value }) => value ?? [])
  screeningRequests?: ScreeningRequestResponseDto[];
}
