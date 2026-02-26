import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

import { DECISION_SOURCES } from '@/modules/common/enums/decision-source.enum';
import type { DecisionSource } from '@/modules/common/enums/decision-source.enum';

export class CreateConclusionDto {
  @ApiPropertyOptional({
    description: 'Whether the doctor agrees with the AI analysis completely',
  })
  @IsOptional()
  @IsBoolean()
  agreesWithAi?: boolean;

  @ApiProperty({
    description: 'Source of the final decision',
    enum: DECISION_SOURCES,
  })
  @IsIn(DECISION_SOURCES)
  decisionSource: DecisionSource;

  @ApiPropertyOptional({
    description: 'Reason for overriding AI analysis (if applicable)',
  })
  @IsOptional()
  @IsString()
  doctorOverrideReason?: string;
}
