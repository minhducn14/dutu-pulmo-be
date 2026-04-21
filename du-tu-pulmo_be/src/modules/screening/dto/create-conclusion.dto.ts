import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
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
  @ValidateIf((o: CreateConclusionDto) => o.agreesWithAi === false)
  @IsNotEmpty({ message: ERROR_MESSAGES.DOCTOR_OVERRIDE_REASON_REQUIRED })
  @IsString()
  doctorOverrideReason?: string;

  @ApiPropertyOptional({
    description: 'Additional notes from the doctor',
  })
  @IsOptional()
  @IsString()
  doctorNotes?: string;

  @ApiPropertyOptional({
    description: 'Final conclusion from the doctor',
  })
  @IsOptional()
  @IsString()
  conclusion?: string;

}
