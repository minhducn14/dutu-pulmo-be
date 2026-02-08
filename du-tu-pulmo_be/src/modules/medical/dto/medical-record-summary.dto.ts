import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Local definitions if needed, or import from medical-response.dto if refactored
export class PrescriptionSummaryDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  prescriptionNumber: string;
  @ApiProperty()
  diagnosis?: string;
  @ApiProperty()
  createdAt: Date;
}

export class MedicalRecordSummaryDto {
  @ApiProperty({ description: 'Medical Record ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'Record number' })
  recordNumber: string;

  // ===== THÔNG TIN CƠ BẢN =====
  @ApiProperty({ description: 'Patient Info' })
  patient: {
    id: string;
    fullName: string;
    dateOfBirth: Date;
  };

  @ApiProperty({ description: 'Doctor Info' })
  doctor: {
    id: string;
    fullName: string;
  };

  // ===== THÔNG TIN ĐIỀU TRỊ =====
  @ApiPropertyOptional({ description: 'Ngày bắt đầu điều trị' })
  treatmentStartDate?: Date;

  @ApiPropertyOptional({ description: 'Ngày kết thúc điều trị' })
  treatmentEndDate?: Date;

  // ===== TỔNG KẾT Y KHOA =====
  @ApiPropertyOptional({ description: 'Chẩn đoán lúc vào viện' })
  initialDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán chính' })
  primaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán phụ' })
  secondaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán ra viện' })
  dischargeDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Diễn biến bệnh' })
  progressNotes?: string;

  @ApiPropertyOptional({ description: 'Phương pháp điều trị đã thực hiện' })
  treatmentGiven?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt kết quả xét nghiệm' })
  significantLabFindings?: string;

  // ===== KẾT QUẢ =====
  @ApiPropertyOptional({ description: 'Tình trạng ra viện' })
  dischargeCondition?: string;

  @ApiPropertyOptional({ description: 'Hướng dẫn tái khám' })
  followUpInstructions?: string;

  // ===== ĐƠN THUỐC & XÉT NGHIỆM =====
  @ApiPropertyOptional({ type: [PrescriptionSummaryDto], description: 'Danh sách đơn thuốc' })
  prescriptions?: PrescriptionSummaryDto[];

  @ApiProperty({ description: 'Trạng thái hồ sơ' })
  status: string;
}
