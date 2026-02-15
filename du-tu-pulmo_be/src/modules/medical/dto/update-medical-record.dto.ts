import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
  IsBoolean,
  IsInt,
  IsDateString,
  IsEnum,
} from 'class-validator';

export class UpdateMedicalRecordDto {
  @ApiPropertyOptional({ description: 'Loại bệnh án' })
  @IsOptional()
  @IsString()
  recordType?: string;

  @ApiPropertyOptional({ description: 'Lý do khám / Lý do vào viện' })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Quá trình bệnh lý' })
  @IsOptional()
  @IsString()
  presentIllness?: string;

  @ApiPropertyOptional({ description: 'Tiền sử bản thân' })
  @IsOptional()
  @IsString()
  medicalHistory?: string;

  @ApiPropertyOptional({ description: 'Tiền sử phẫu thuật' })
  @IsOptional()
  @IsString()
  surgicalHistory?: string;

  @ApiPropertyOptional({ description: 'Tiền sử gia đình' })
  @IsOptional()
  @IsString()
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Khám toàn thân' })
  @IsOptional()
  @IsString()
  physicalExamNotes?: string;

  @ApiPropertyOptional({ description: 'Các bộ phận' })
  @IsOptional()
  @IsString()
  systemsReview?: string;

  @ApiPropertyOptional({ description: 'Đánh giá / Assessment' })
  @IsOptional()
  @IsString()
  assessment?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán' })
  @IsOptional()
  @IsString()
  diagnosis?: string;

  @ApiPropertyOptional({ description: 'Phác đồ điều trị' })
  @IsOptional()
  @IsString()
  treatmentPlan?: string;

  @ApiPropertyOptional({ description: 'Đã xử lý' })
  @IsOptional()
  @IsString()
  treatmentGiven?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán ra viện' })
  @IsOptional()
  @IsString()
  dischargeDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Ngày bắt đầu điều trị' })
  @IsOptional()
  @IsDateString()
  treatmentStartDate?: string;

  @ApiPropertyOptional({ description: 'Ngày kết thúc điều trị' })
  @IsOptional()
  @IsDateString()
  treatmentEndDate?: string;

  @ApiPropertyOptional({ description: 'Diễn biến bệnh (Progress Notes)' })
  @IsOptional()
  @IsString()
  progressNotes?: string;

  @ApiPropertyOptional({ description: 'Bệnh chính' })
  @IsOptional()
  @IsString()
  primaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Bệnh kèm theo' })
  @IsOptional()
  @IsString()
  secondaryDiagnosis?: string;

  @ApiPropertyOptional({ description: 'Tình trạng ra viện' })
  @IsOptional()
  @IsString()
  dischargeCondition?: string;

  @ApiPropertyOptional({ description: 'Hướng dẫn tái khám' })
  @IsOptional()
  @IsString()
  followUpInstructions?: string;

  @ApiPropertyOptional({ description: 'Tóm tắt toàn bộ hồ sơ' })
  @IsOptional()
  @IsString()
  fullRecordSummary?: string;

  @ApiPropertyOptional({ description: 'Dị ứng', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional({ description: 'Bệnh mãn tính', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronicDiseases?: string[];

  @ApiPropertyOptional({ description: 'Thuốc đang dùng', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentMedications?: string[];

  @ApiPropertyOptional({ description: 'Hút thuốc', type: Boolean })
  @IsOptional()
  @IsBoolean()
  smokingStatus?: boolean;

  @ApiPropertyOptional({ description: 'Số năm hút thuốc', type: Number })
  @IsOptional()
  @IsInt()
  smokingYears?: number;

  @ApiPropertyOptional({ description: 'Uống rượu bia', type: Boolean })
  @IsOptional()
  @IsBoolean()
  alcoholConsumption?: boolean;

}
