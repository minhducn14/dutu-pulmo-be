import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum SignedStatusEnum {
  NOT_SIGNED = 'NOT_SIGNED',
  SIGNED = 'SIGNED',
}

export class MedicalRecordDetailResponseDto {
  @ApiProperty({ description: 'Medical Record ID' })
  id: string;

  @ApiProperty({ description: 'Record number' })
  recordNumber: string;

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
  digitalSignature?: string;

  // TAB 1: BỆNH ÁN
  @ApiProperty({ description: 'Loại bệnh án' })
  recordType: string;

  @ApiPropertyOptional({ description: 'Chuyên khoa' })
  specialty?: string;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Đối tượng' })
  patientCategory?: string;

  @ApiPropertyOptional({ description: 'Số thẻ BHYT' })
  insuranceNumber?: string;

  @ApiPropertyOptional({ description: 'Thời hạn BHYT' })
  insuranceExpiry?: Date;

  @ApiPropertyOptional({ description: 'Họ tên người nhà' })
  emergencyContactName?: string;

  @ApiPropertyOptional({ description: 'SĐT người nhà' })
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ description: 'Địa chỉ người nhà' })
  emergencyContactAddress?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán của nơi giới thiệu' })
  referralDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Lý do vào viện' })
  chiefComplaint?: string;

  @ApiProperty({ description: 'Chỉ số sinh hiệu' })
  vitalSigns: {
    pulse?: number;
    temperature?: number;
    respiratoryRate?: number;
    weight?: number;
    bloodPressure?: string;
    heartRate?: number;
    height?: number;
    bmi?: number;
  };

  @ApiPropertyOptional({ description: 'Quá trình bệnh lý' })
  presentIllness?: string;

  @ApiPropertyOptional({ description: 'Tiền sử bản thân' })
  medicalHistory?: string;

  @ApiPropertyOptional({ description: 'Tiền sử gia đình' })
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Khám toàn thân' })
  physicalExamNotes?: string;

  @ApiPropertyOptional({ description: 'Các bộ phận' })
  systemsReview?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt kết quả CLS' })
  labSummary?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán ban đầu' })
  initialDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Đã xử lý' })
  treatmentGiven?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán khi ra viện' })
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
      duration: string;
    }>;
    notes?: string;
    createdAt: Date;
  }>;

  // TAB 3: TỔNG KẾT
  @ApiPropertyOptional({ description: 'Quá trình bệnh lý và diễn biến' })
  progressNotes?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt XN có giá trị' })
  significantLabFindings?: string;

  @ApiPropertyOptional({ description: 'Bệnh chính' })
  primaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Bệnh kèm theo' })
  secondaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Phương pháp điều trị' })
  treatmentPlan?: string;

  @ApiPropertyOptional({ description: 'Tình trạng ra viện' })
  dischargeCondition?: string;

  @ApiPropertyOptional({ description: 'Hướng điều trị tiếp theo' })
  followUpInstructions?: string;

  @ApiPropertyOptional({ description: 'Hồ sơ phim ảnh' })
  imagingRecords?: {
    xray?: string;
    ctScan?: string;
    ultrasound?: string;
    labTests?: string;
    fullRecord?: string;
  };

  @ApiProperty({ description: 'Status bệnh án' })
  status: string;

  @ApiProperty({ description: 'Updated at' })
  updatedAt: Date;
}
