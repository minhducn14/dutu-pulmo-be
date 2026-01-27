import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MaxLength,
  IsArray,
  IsBoolean,
  IsInt,
  IsDateString,
} from 'class-validator';

/**
 * DTO for updating a MedicalRecord via appointment endpoint
 */
export class UpdateMedicalRecordDto {
  @ApiPropertyOptional({ description: 'Lý do khám' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Ghi chú khám lâm sàng (khám thực thể)' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  physicalExamNotes?: string;

  @ApiPropertyOptional({ description: 'Đánh giá chung của bác sĩ' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  assessment?: string;

  @ApiPropertyOptional({ description: 'Chẩn đoán bệnh' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  diagnosisNotes?: string;

  @ApiPropertyOptional({ description: 'Phác đồ điều trị' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  treatmentPlan?: string;

  @ApiPropertyOptional({ description: 'Bệnh lý hiện tại' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  presentIllness?: string;

  @ApiPropertyOptional({ description: 'Tiền sử bệnh' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  medicalHistory?: string;

  @ApiPropertyOptional({ description: 'Tiền sử phẫu thuật' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  surgicalHistory?: string;

  @ApiPropertyOptional({ description: 'Tiền sử gia đình' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Danh sách dị ứng', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allergies?: string[];

  @ApiPropertyOptional({
    description: 'Danh sách bệnh mãn tính',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  chronicDiseases?: string[];

  @ApiPropertyOptional({
    description: 'Danh sách thuốc đang dùng',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentMedications?: string[];

  @ApiPropertyOptional({ description: 'Trạng thái hút thuốc', type: Boolean })
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

  @ApiPropertyOptional({ description: 'Nghề nghiệp' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  occupation?: string;

  @ApiPropertyOptional({ description: 'Hướng dẫn tái khám' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  followUpInstructions?: string;

  @ApiPropertyOptional({ description: 'Ghi chú diễn biến bệnh' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  progressNotes?: string;

  @ApiPropertyOptional({ description: 'Có cần tái khám không', type: Boolean })
  @IsOptional()
  @IsBoolean()
  followUpRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Ngày dự kiến tái khám',
    example: '2026-02-15T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  nextAppointmentDate?: string;
}
