import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScreeningConclusionResponseDto {
  @ApiProperty({ example: 'f1e2d3c4-b5a6-7890-1234-56789abcdef0' })
  id: string;

  @ApiPropertyOptional({ example: 'd2c1b3a4-5e6f-7890-1234-56789abcdef0' })
  screeningId?: string;

  @ApiPropertyOptional({ example: '1e2f3a4b-5c6d-7e8f-9012-3456789abcde' })
  aiAnalysisId?: string;

  @ApiPropertyOptional({ example: 'c3b2a1d4-5e6f-7890-1234-56789abcdef0' })
  medicalRecordId?: string;

  @ApiProperty({ example: '9a8b7c6d-5e4f-3210-9876-54321fedcba0' })
  patientId: string;

  @ApiPropertyOptional({ example: '0a1b2c3d-4e5f-6789-0123-456789abcdef' })
  doctorId?: string;

  @ApiPropertyOptional({ example: true })
  agreesWithAi?: boolean;



  @ApiPropertyOptional({
    example: 'DOCTOR_REVIEWED_AI',
    description: 'AI_ONLY, DOCTOR_ONLY, DOCTOR_REVIEWED_AI',
  })
  decisionSource?: 'AI_ONLY' | 'DOCTOR_ONLY' | 'DOCTOR_REVIEWED_AI';

  @ApiPropertyOptional({ example: 'Override reason' })
  doctorOverrideReason?: string;



  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  reviewedAt: Date;

  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  updatedAt: Date;

  static fromEntity(conclusion: {
    id: string;
    screeningId?: string | null;
    aiAnalysisId?: string | null;
    medicalRecordId?: string | null;
    patientId: string;
    doctorId?: string | null;
    agreesWithAi?: boolean | null;

    decisionSource?: 'AI_ONLY' | 'DOCTOR_ONLY' | 'DOCTOR_REVIEWED_AI' | null;
    doctorOverrideReason?: string | null;

    reviewedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): ScreeningConclusionResponseDto {
    const dto = new ScreeningConclusionResponseDto();
    dto.id = conclusion.id;
    dto.screeningId = conclusion.screeningId ?? undefined;
    dto.aiAnalysisId = conclusion.aiAnalysisId ?? undefined;
    dto.medicalRecordId = conclusion.medicalRecordId ?? undefined;
    dto.patientId = conclusion.patientId;
    dto.doctorId = conclusion.doctorId ?? undefined;
    dto.agreesWithAi = conclusion.agreesWithAi ?? undefined;

    dto.decisionSource = conclusion.decisionSource ?? undefined;
    dto.doctorOverrideReason = conclusion.doctorOverrideReason ?? undefined;

    dto.reviewedAt = conclusion.reviewedAt;
    dto.createdAt = conclusion.createdAt;
    dto.updatedAt = conclusion.updatedAt;
    return dto;
  }

  static fromNullable(
    conclusion:
      | Parameters<typeof ScreeningConclusionResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): ScreeningConclusionResponseDto | null {
    return conclusion
      ? ScreeningConclusionResponseDto.fromEntity(conclusion)
      : null;
  }
}
