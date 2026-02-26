import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ScreeningRequestResponseDto } from '@/modules/screening/dto/screening-request-response.dto';
const toOptionalString = ({ value }: { value: unknown }): string =>
  typeof value === 'string' ? value : '';

const toStringArray = ({ value }: { value: unknown }): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const toScreeningRequests = ({
  value,
}: {
  value: unknown;
}): ScreeningRequestResponseDto[] =>
  Array.isArray(value) ? (value as ScreeningRequestResponseDto[]) : [];

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
  @Transform(toOptionalString)
  digitalSignature?: string;

  @ApiPropertyOptional({ description: 'Diagnosis' })
  @Transform(toOptionalString)
  diagnosis?: string;

  // TAB 1: BỆNH ÁN
  @ApiProperty({ description: 'Loại bệnh án' })
  recordType: string;

  @ApiPropertyOptional({ description: 'Lý do vào viện' })
  @Transform(toOptionalString)
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
  @Transform(toOptionalString)
  presentIllness?: string;

  @ApiPropertyOptional({ description: 'Tiền sử bệnh tật' })
  @Transform(toOptionalString)
  medicalHistory?: string;

  @ApiPropertyOptional({ description: 'Tiền sử gia đình' })
  @Transform(toOptionalString)
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Khám toàn thân' })
  @Transform(toOptionalString)
  physicalExamNotes?: string;

  @ApiPropertyOptional({ description: 'Các bệnh lý' })
  @Transform(toOptionalString)
  systemsReview?: string;

  @ApiPropertyOptional({ description: 'Đã điều trị' })
  @Transform(toOptionalString)
  treatmentGiven?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán khi ra viện' })
  @Transform(toOptionalString)
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
    pdfUrl?: string;
    instructions?: string;
  }>;

    // TAB 3: TỔNG KẾT
  @ApiPropertyOptional({ description: 'Quá trình bệnh lý và diễn biến' })
  @Transform(toOptionalString)
  progressNotes?: string;

  @ApiPropertyOptional({ description: 'Bệnh chính' })
  @Transform(toOptionalString)
  primaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Bệnh kèm theo' })
  @Transform(toOptionalString)
  secondaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Phương pháp điều trị' })
  @Transform(toOptionalString)
  treatmentPlan?: string;

  @ApiPropertyOptional({ description: 'Tình trạng ra viện' })
  @Transform(toOptionalString)
  dischargeCondition?: string;

  @ApiPropertyOptional({ description: 'Hướng điều trị tiếp theo' })
  @Transform(toOptionalString)
  followUpInstructions?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt hồ sơ' })
  @Transform(toOptionalString)
  fullRecordSummary?: string;

  @ApiPropertyOptional({ description: 'Đánh giá chẩn đoán' })
  @Transform(toOptionalString)
  assessment?: string;

  @ApiPropertyOptional({ description: 'Lịch sử phẫu thuật' })
  @Transform(toOptionalString)
  surgicalHistory?: string;

  @ApiPropertyOptional({ description: 'Danh sách dị ứng' })
  @Transform(toStringArray)
  allergies?: string[];

  @ApiPropertyOptional({ description: 'Chẩn đoán tật' })
  @Transform(toStringArray)
  chronicDiseases?: string[];

  @ApiPropertyOptional({ description: 'Danh sách thuốc hiện tại' })
  @Transform(toStringArray)
  currentMedications?: string[];

  @ApiPropertyOptional({ description: 'Tình trạng hút thuốc' })
  smokingStatus?: boolean;

  @ApiPropertyOptional({ description: 'Số năm hút thuốc' })
  smokingYears?: number;

  @ApiPropertyOptional({ description: 'Tình trạng rượu bia' })
  alcoholConsumption?: boolean;

  @ApiProperty({ description: 'Trạng thái bệnh án' })
  status: string;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'PDF URL' })
  @Transform(toOptionalString)
  pdfUrl?: string;

  @ApiPropertyOptional({ type: [ScreeningRequestResponseDto] })
  @Transform(toScreeningRequests)
  screeningRequests?: ScreeningRequestResponseDto[];
}
