import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScreeningPriorityEnum } from '@/modules/common/enums/screening-priority.enum';
import { ScreeningStatusEnum } from '@/modules/common/enums/screening-status.enum';
import { ScreeningTypeEnum } from '@/modules/common/enums/screening-type.enum';
import { DoctorResponseDto } from '@/modules/doctor/dto/doctor-response.dto';
import { PatientResponseDto } from '@/modules/patient/dto/patient-response.dto';
import { AiAnalysisResponseDto } from '@/modules/screening/dto/ai-analysis-entity-response.dto';
import { MedicalImageResponseDto } from '@/modules/screening/dto/medical-image-response.dto';
import { ScreeningConclusionResponseDto } from '@/modules/screening/dto/screening-conclusion-response.dto';

export class ScreeningRequestResponseDto {
  @ApiProperty({ example: 'd2c1b3a4-5e6f-7890-1234-56789abcdef0' })
  id: string;

  @ApiProperty({ example: '9a8b7c6d-5e4f-3210-9876-54321fedcba0' })
  patientId: string;

  @ApiPropertyOptional({ example: '0a1b2c3d-4e5f-6789-0123-456789abcdef' })
  uploadedByDoctorId?: string;

  @ApiProperty({ example: 'SCR-1Z2A3B-4C5D' })
  screeningNumber: string;

  @ApiProperty({ enum: ScreeningTypeEnum, example: ScreeningTypeEnum.XRAY })
  screeningType: ScreeningTypeEnum;

  @ApiProperty({
    enum: ScreeningStatusEnum,
    example: ScreeningStatusEnum.UPLOADED,
  })
  status: ScreeningStatusEnum;

  @ApiProperty({
    enum: ScreeningPriorityEnum,
    example: ScreeningPriorityEnum.NORMAL,
  })
  priority: ScreeningPriorityEnum;



  @ApiPropertyOptional({ example: '2024-10-11T09:30:00.000Z' })
  requestedAt?: Date;

  @ApiPropertyOptional({ example: '2024-10-11T09:30:00.000Z' })
  uploadedAt?: Date;

  @ApiPropertyOptional({ example: '2024-10-11T09:30:00.000Z' })
  aiStartedAt?: Date;

  @ApiPropertyOptional({ example: '2024-10-11T09:30:00.000Z' })
  aiCompletedAt?: Date;



  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: PatientResponseDto })
  patient?: PatientResponseDto;

  @ApiPropertyOptional({ type: DoctorResponseDto })
  uploadedByDoctor?: DoctorResponseDto;



  @ApiPropertyOptional({ type: [MedicalImageResponseDto] })
  images?: MedicalImageResponseDto[];

  @ApiPropertyOptional({ type: [AiAnalysisResponseDto] })
  aiAnalyses?: AiAnalysisResponseDto[];

  @ApiPropertyOptional({ type: [ScreeningConclusionResponseDto] })
  conclusions?: ScreeningConclusionResponseDto[];

  static fromEntity(screening: {
    id: string;
    patientId: string;
    uploadedByDoctorId?: string | null;
    screeningNumber: string;
    screeningType: ScreeningTypeEnum;
    status: ScreeningStatusEnum;
    priority: ScreeningPriorityEnum;

    requestedAt?: Date | null;
    uploadedAt?: Date | null;
    aiStartedAt?: Date | null;
    aiCompletedAt?: Date | null;

    createdAt: Date;
    updatedAt: Date;
    patient?: Parameters<typeof PatientResponseDto.fromEntity>[0] | null;
    uploadedByDoctor?:
      | Parameters<typeof DoctorResponseDto.fromEntity>[0]
      | null;

    images?: Parameters<typeof MedicalImageResponseDto.fromEntity>[0][] | null;
    aiAnalyses?:
      | Parameters<typeof AiAnalysisResponseDto.fromEntity>[0][]
      | null;
    conclusions?:
      | Parameters<typeof ScreeningConclusionResponseDto.fromEntity>[0][]
      | null;
  }): ScreeningRequestResponseDto {
    const dto = new ScreeningRequestResponseDto();
    dto.id = screening.id;
    dto.patientId = screening.patientId;
    dto.uploadedByDoctorId = screening.uploadedByDoctorId ?? undefined;
    dto.screeningNumber = screening.screeningNumber;
    dto.screeningType = screening.screeningType;
    dto.status = screening.status;
    dto.priority = screening.priority;

    dto.requestedAt = screening.requestedAt ?? undefined;
    dto.uploadedAt = screening.uploadedAt ?? undefined;
    dto.aiStartedAt = screening.aiStartedAt ?? undefined;
    dto.aiCompletedAt = screening.aiCompletedAt ?? undefined;

    dto.createdAt = screening.createdAt;
    dto.updatedAt = screening.updatedAt;
    dto.patient = screening.patient
      ? PatientResponseDto.fromEntity(screening.patient)
      : undefined;
    dto.uploadedByDoctor = screening.uploadedByDoctor
      ? DoctorResponseDto.fromEntity(screening.uploadedByDoctor)
      : undefined;

    dto.images = screening.images
      ? screening.images.map((image) =>
          MedicalImageResponseDto.fromEntity(image),
        )
      : undefined;
    dto.aiAnalyses = screening.aiAnalyses
      ? screening.aiAnalyses.map((analysis) =>
          AiAnalysisResponseDto.fromEntity(analysis),
        )
      : undefined;
    dto.conclusions = screening.conclusions
      ? screening.conclusions.map((conclusion) =>
          ScreeningConclusionResponseDto.fromEntity(conclusion),
        )
      : undefined;
    return dto;
  }

  static fromNullable(
    screening:
      | Parameters<typeof ScreeningRequestResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): ScreeningRequestResponseDto | null {
    return screening ? ScreeningRequestResponseDto.fromEntity(screening) : null;
  }
}
