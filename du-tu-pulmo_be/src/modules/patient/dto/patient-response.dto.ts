import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMeta } from '@/common/dto/pagination.dto';

/**
 * Response DTO for Patient
 */
export class PatientResponseDto {
  @ApiProperty({ description: 'Patient ID (UUID)' })
  id: string;

  @ApiProperty({ description: 'User ID (UUID)' })
  userId: string;

  @ApiPropertyOptional({ description: 'Mã bệnh nhân' })
  profileCode?: string;

  @ApiPropertyOptional({ description: 'Nhóm máu' })
  bloodType?: string;

  @ApiPropertyOptional({ description: 'Tên liên hệ khẩn cấp' })
  emergencyContactName?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ khẩn cấp' })
  emergencyContactPhone?: string;

  @ApiPropertyOptional({
    description: 'Mối quan hệ với người liên hệ khẩn cấp',
  })
  emergencyContactRelationship?: string;

  @ApiPropertyOptional({ description: 'Nhà cung cấp bảo hiểm' })
  insuranceProvider?: string;

  @ApiPropertyOptional({ description: 'Số bảo hiểm' })
  insuranceNumber?: string;

  @ApiPropertyOptional({ description: 'Ngày hết hạn bảo hiểm' })
  insuranceExpiry?: Date;

  @ApiProperty({ description: 'Ngày tạo' })
  createdAt: Date;

  @ApiProperty({ description: 'Ngày cập nhật' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Thông tin user (nếu có relation)' })
  user?: any;

  static fromEntity(patient: {
    id: string;
    userId: string;
    profileCode?: string;
    bloodType?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelationship?: string;
    insuranceProvider?: string;
    insuranceNumber?: string;
    insuranceExpiry?: Date;
    createdAt: Date;
    updatedAt: Date;
    user?: {
      id?: string;
      fullName?: string;
      phone?: string;
      gender?: string;
      dateOfBirth?: Date;
      avatarUrl?: string;
      status?: string;
    };
  }): PatientResponseDto {
    const dto = new PatientResponseDto();
    dto.id = patient.id;
    dto.userId = patient.userId;
    dto.profileCode = patient.profileCode;
    dto.bloodType = patient.bloodType;
    dto.emergencyContactName = patient.emergencyContactName;
    dto.emergencyContactPhone = patient.emergencyContactPhone;
    dto.emergencyContactRelationship = patient.emergencyContactRelationship;
    dto.insuranceProvider = patient.insuranceProvider;
    dto.insuranceNumber = patient.insuranceNumber;
    dto.insuranceExpiry = patient.insuranceExpiry;
    dto.createdAt = patient.createdAt;
    dto.updatedAt = patient.updatedAt;
    if (patient.user) {
      dto.user = {
        id: patient.user.id,
        fullName: patient.user.fullName,
        phone: patient.user.phone,
        gender: patient.user.gender,
        dateOfBirth: patient.user.dateOfBirth,
        avatarUrl: patient.user.avatarUrl,
        status: patient.user.status,
      };
    }
    return dto;
  }

  static fromNullable(
    patient:
      | Parameters<typeof PatientResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): PatientResponseDto | null {
    return patient ? PatientResponseDto.fromEntity(patient) : null;
  }
}

/**
 * Paginated response for patients list
 */
export class PaginatedPatientResponseDto {
  @ApiProperty({ type: [PatientResponseDto] })
  items: PatientResponseDto[];

  @ApiProperty({ type: PaginationMeta })
  meta: PaginationMeta;
}

/**
 * Patient profile with summary statistics
 */
export class PatientProfileResponseDto {
  @ApiProperty({ type: PatientResponseDto })
  patient: PatientResponseDto;

  @ApiProperty({
    description: 'Thống kê tổng hợp',
    example: {
      totalMedicalRecords: 5,
      totalVitalSigns: 12,
      totalPrescriptions: 3,
      latestVitalSign: null,
    },
  })
  summary: {
    totalMedicalRecords: number;
    totalVitalSigns: number;
    totalPrescriptions: number;
    latestVitalSign: any;
  };
}
