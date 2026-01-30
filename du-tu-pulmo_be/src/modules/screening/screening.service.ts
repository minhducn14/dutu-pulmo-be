import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ScreeningRequest } from './entities/screening-request.entity';
import { MedicalImage } from './entities/medical-image.entity';
import { AiAnalysis } from './entities/ai-analysis.entity';
import { ScreeningConclusion } from './entities/screening-conclusion.entity';

@Injectable()
export class ScreeningService {
  private readonly logger = new Logger(ScreeningService.name);
  private readonly pulmoAiBaseUrl: string;
  private readonly maxRetries: number = 3;

  constructor(
    @InjectRepository(ScreeningRequest)
    private readonly screeningRepository: Repository<ScreeningRequest>,
    @InjectRepository(MedicalImage)
    private readonly imageRepository: Repository<MedicalImage>,
    @InjectRepository(AiAnalysis)
    private readonly aiAnalysisRepository: Repository<AiAnalysis>,
    @InjectRepository(ScreeningConclusion)
    private readonly conclusionRepository: Repository<ScreeningConclusion>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.pulmoAiBaseUrl = this.configService.get<string>(
      'PULMO_AI_BASE_URL',
      'http://localhost:5000',
    );
  }
}
