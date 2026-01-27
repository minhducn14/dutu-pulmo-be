import { ApiProperty } from '@nestjs/swagger';
import { AiAnalysisResponseDto } from './ai-analysis-entity-response.dto';
import { MedicalImageResponseDto } from './medical-image-response.dto';
import { ScreeningRequestResponseDto } from './screening-request-response.dto';

export class UploadAnalyzeResponseDto {
  @ApiProperty({ type: () => ScreeningRequestResponseDto })
  screening: ScreeningRequestResponseDto;

  @ApiProperty({ type: () => MedicalImageResponseDto })
  image: MedicalImageResponseDto;

  @ApiProperty({ type: () => AiAnalysisResponseDto })
  analysis: AiAnalysisResponseDto;
}
