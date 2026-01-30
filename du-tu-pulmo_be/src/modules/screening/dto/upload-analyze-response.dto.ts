import { ApiProperty } from '@nestjs/swagger';
import { AiAnalysisResponseDto } from '@/modules/screening/dto/ai-analysis-entity-response.dto';
import { MedicalImageResponseDto } from '@/modules/screening/dto/medical-image-response.dto';
import { ScreeningRequestResponseDto } from '@/modules/screening/dto/screening-request-response.dto';

export class UploadAnalyzeResponseDto {
  @ApiProperty({ type: () => ScreeningRequestResponseDto })
  screening: ScreeningRequestResponseDto;

  @ApiProperty({ type: () => MedicalImageResponseDto })
  image: MedicalImageResponseDto;

  @ApiProperty({ type: () => AiAnalysisResponseDto })
  analysis: AiAnalysisResponseDto;
}
