import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicalRecordExaminationDto {
  @ApiProperty({ description: 'Medical Record ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Record number (mã hồ sơ)' })
  recordNumber: string;

  // ===== THÔNG TIN HÀNH CHÍNH =====
  @ApiProperty({ description: 'Patient Info' })
  patient: {
    id: string;
    fullName: string;
    dateOfBirth: Date;
    gender: string;
    phone: string;
    address: string;
  };

  // ===== TIỀN SỬ & CẢNH BÁO (Read-only, highlight) =====
  @ApiPropertyOptional({ description: 'Dị ứng (Cảnh báo đỏ)' })
  allergies?: string[];

  @ApiPropertyOptional({ description: 'Bệnh mãn tính (Cảnh báo vàng)' })
  chronicDiseases?: string[];

  @ApiPropertyOptional({ description: 'Thuốc đang dùng' })
  currentMedications?: string[];

  // ===== SINH HIỆU MỚI NHẤT =====
  @ApiPropertyOptional({ description: 'Chỉ số sinh tồn mới nhất' })
  latestVitalSign?: {
    temperature?: number;
    bloodPressure?: string;
    heartRate?: number;
    spo2?: number;
    weight?: number;
    height?: number;
    bmi?: number;
    recordedAt: Date;
  };

  // ===== THÔNG TIN KHÁM HIỆN TẠI (Editable) =====
  @ApiPropertyOptional({ description: 'Lý do khám' })
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Bệnh sử' })
  presentIllness?: string;

  @ApiPropertyOptional({ description: 'Khám lâm sàng' })
  physicalExamNotes?: string;

  @ApiPropertyOptional({ description: 'Đánh giá/Nhận xét' })
  assessment?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán sơ bộ' })
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Kế hoạch điều trị' })
  treatmentPlan?: string;

  // ===== LỊCH SỬ KHÁM GẦN NHẤT (3 lần) =====
  @ApiPropertyOptional({ description: 'Lịch sử khám gần nhất' })
  recentRecords?: Array<{
    id: string;
    recordNumber: string;
    visitDate: Date;
    diagnosis: string;
    doctor: string;
  }>;

  @ApiProperty({ description: 'Trạng thái hồ sơ' })
  status: string;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;
}
