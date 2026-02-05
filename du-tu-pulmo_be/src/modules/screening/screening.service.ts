import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { ScreeningRequest } from '@/modules/screening/entities/screening-request.entity';
import { MedicalImage } from '@/modules/screening/entities/medical-image.entity';
import {
  AiAnalysis,
  AiFinding,
  AiGrayZoneNote,
  AiPrimaryDiagnosis,
} from '@/modules/screening/entities/ai-analysis.entity';
import { ScreeningConclusion } from '@/modules/screening/entities/screening-conclusion.entity';
import { ScreeningStatusEnum } from '@/modules/common/enums/screening-status.enum';
import { AiDiagnosisStatusEnum } from '@/modules/common/enums/ai-diagnosis-status.enum';
import { PulmoAiResponseDto } from '@/modules/screening/dto/ai-analysis-response.dto';
import { SCREENING_ERRORS } from '@/common/constants/error-messages.constant';

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

  async findAll(): Promise<ScreeningRequest[]> {
    return this.screeningRepository.find({
      relations: ['patient', 'uploadedByDoctor', 'assignedDoctor'],
    });
  }

  async findById(id: string): Promise<ScreeningRequest> {
    const screening = await this.screeningRepository.findOne({
      where: { id },
      relations: [
        'patient',
        'uploadedByDoctor',
        'assignedDoctor',
        'images',
        'aiAnalyses',
        'conclusions',
      ],
    });
    if (!screening)
      throw new NotFoundException(SCREENING_ERRORS.SCREENING_NOT_FOUND);
    return screening;
  }

  async create(data: Partial<ScreeningRequest>): Promise<ScreeningRequest> {
    const screening = this.screeningRepository.create({
      ...data,
      screeningNumber: this.generateScreeningNumber(),
      requestedAt: new Date(),
    });

    return this.screeningRepository.save(screening);
  }

  private readonly validTransitions: Record<
    ScreeningStatusEnum,
    ScreeningStatusEnum[]
  > = {
    [ScreeningStatusEnum.UPLOADED]: [
      ScreeningStatusEnum.PENDING_AI,
      ScreeningStatusEnum.AI_PROCESSING,
      ScreeningStatusEnum.CANCELLED,
    ],
    [ScreeningStatusEnum.PENDING_AI]: [
      ScreeningStatusEnum.AI_PROCESSING,
      ScreeningStatusEnum.CANCELLED,
    ],
    [ScreeningStatusEnum.AI_PROCESSING]: [
      ScreeningStatusEnum.AI_COMPLETED,
      ScreeningStatusEnum.AI_FAILED,
      ScreeningStatusEnum.CANCELLED,
    ],
    [ScreeningStatusEnum.AI_COMPLETED]: [
      ScreeningStatusEnum.PENDING_DOCTOR,
      ScreeningStatusEnum.CANCELLED,
    ],
    [ScreeningStatusEnum.AI_FAILED]: [
      ScreeningStatusEnum.AI_PROCESSING, // Retry
      ScreeningStatusEnum.CANCELLED,
    ],
    [ScreeningStatusEnum.PENDING_DOCTOR]: [
      ScreeningStatusEnum.DOCTOR_REVIEWING,
      ScreeningStatusEnum.CANCELLED,
    ],
    [ScreeningStatusEnum.DOCTOR_REVIEWING]: [
      ScreeningStatusEnum.DOCTOR_COMPLETED,
      ScreeningStatusEnum.PENDING_DOCTOR, // Back for re-review
      ScreeningStatusEnum.CANCELLED,
    ],
    [ScreeningStatusEnum.DOCTOR_COMPLETED]: [], // Terminal state
    [ScreeningStatusEnum.CANCELLED]: [], // Terminal state
  };

  private validateStatusTransition(
    currentStatus: ScreeningStatusEnum,
    newStatus: ScreeningStatusEnum,
  ): void {
    const allowedTransitions = this.validTransitions[currentStatus] || [];
    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        SCREENING_ERRORS.INVALID_STATUS_TRANSITION,
      );
    }
  }

  async updateStatus(
    id: string,
    status: ScreeningStatusEnum,
  ): Promise<ScreeningRequest> {
    const screening = await this.findById(id);

    // Validate state transition
    this.validateStatusTransition(screening.status, status);

    const updateData: Partial<ScreeningRequest> = { status };

    if (status === ScreeningStatusEnum.AI_PROCESSING) {
      updateData.aiStartedAt = new Date();
    } else if (status === ScreeningStatusEnum.AI_COMPLETED) {
      updateData.aiCompletedAt = new Date();
    } else if (status === ScreeningStatusEnum.DOCTOR_COMPLETED) {
      updateData.doctorCompletedAt = new Date();
    } else if (status === ScreeningStatusEnum.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    await this.screeningRepository.update(id, updateData);
    return this.findById(id);
  }

  async addImage(
    screeningId: string,
    imageData: Partial<MedicalImage>,
  ): Promise<MedicalImage> {
    const image = this.imageRepository.create({ ...imageData, screeningId });
    return this.imageRepository.save(image);
  }

  async addAiAnalysis(data: Partial<AiAnalysis>): Promise<AiAnalysis> {
    const analysis = this.aiAnalysisRepository.create(data);
    return this.aiAnalysisRepository.save(analysis);
  }

  async addConclusion(
    data: Partial<ScreeningConclusion>,
  ): Promise<ScreeningConclusion> {
    const conclusion = this.conclusionRepository.create(data);
    return this.conclusionRepository.save(conclusion);
  }

  private generateScreeningNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `SCR-${timestamp}-${random}`;
  }

  async findImageById(imageId: string): Promise<MedicalImage> {
    const image = await this.imageRepository.findOne({
      where: { id: imageId },
      relations: ['screening'],
    });
    if (!image) {
      throw new NotFoundException(SCREENING_ERRORS.SCREENING_IMAGE_NOT_FOUND);
    }
    return image;
  }

  async findByPatient(patientId: string): Promise<ScreeningRequest[]> {
    return this.screeningRepository.find({
      where: { patientId },
      relations: ['assignedDoctor', 'images'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByDoctor(doctorId: string): Promise<ScreeningRequest[]> {
    return this.screeningRepository.find({
      where: { assignedDoctorId: doctorId },
      relations: ['patient', 'images', 'uploadedByDoctor'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUploaderDoctor(doctorId: string): Promise<ScreeningRequest[]> {
    return this.screeningRepository.find({
      where: { uploadedByDoctorId: doctorId },
      relations: ['patient', 'images', 'assignedDoctor', 'uploadedByDoctor'],
      order: { createdAt: 'DESC' },
    });
  }

  async checkPulmoAiHealth(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ status?: string }>(
          `${this.pulmoAiBaseUrl}/health`,
          {
            timeout: 5000,
          },
        ),
      );
      return response.data?.status === 'ok';
    } catch (error) {
      this.logger.error('Pulmo AI health check failed', error);
      return false;
    }
  }

  async triggerAiAnalysis(
    screeningId: string,
    imageId: string,
    modelVersion: string = 'yolo11-vinbigdata-v1',
  ): Promise<AiAnalysis> {
    return this.screeningRepository.manager.transaction(
      async (manager: EntityManager) => {
        const screening = await manager.findOne(ScreeningRequest, {
          where: { id: screeningId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!screening) {
          throw new NotFoundException(SCREENING_ERRORS.SCREENING_NOT_FOUND);
        }

        if (screening.status === ScreeningStatusEnum.CANCELLED) {
          throw new BadRequestException(SCREENING_ERRORS.CANNOT_ANALYZE_CANCELLED);
        }

        const image = await this.findImageById(imageId);
        if (image.screeningId !== screeningId) {
          throw new BadRequestException(
            SCREENING_ERRORS.IMAGE_NOT_BELONG_TO_SCREENING,
          );
        }

        screening.status = ScreeningStatusEnum.AI_PROCESSING;
        screening.aiStartedAt = new Date();
        await manager.save(screening);

        let aiAnalysis = manager.create(AiAnalysis, {
          screeningId,
          medicalImageId: imageId,
          modelName: 'YOLO11-VinBigData',
          modelVersion,
          modelType: 'YOLO',
          diagnosisStatus: AiDiagnosisStatusEnum.PENDING,
        });
        aiAnalysis = await manager.save(aiAnalysis);

        try {
          const pulmoResponse = await this.callPulmoAiPredictWithRetry(
            image.fileUrl,
          );

          const updateData = this.mapPulmoAiToEntity(pulmoResponse);

          await manager.update(AiAnalysis, aiAnalysis.id, {
            ...updateData,
            analyzedAt: new Date(),
          });

          if (pulmoResponse.success) {
            screening.status = ScreeningStatusEnum.AI_COMPLETED;
            screening.aiCompletedAt = new Date();
          } else {
            screening.status = ScreeningStatusEnum.AI_FAILED;
          }
          await manager.save(screening);

          const updatedAnalysis = await manager.findOne(AiAnalysis, {
            where: { id: aiAnalysis.id },
            relations: ['screening', 'medicalImage'],
          });

          if (!updatedAnalysis) {
            throw new InternalServerErrorException(
              SCREENING_ERRORS.AI_ANALYSIS_RETRIEVE_FAILED,
            );
          }

          return updatedAnalysis;
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Phân tích AI thất bại';
          this.logger.error(
            message,
            error instanceof Error ? error.stack : undefined,
          );

          await manager.update(AiAnalysis, aiAnalysis.id, {
            diagnosisStatus: AiDiagnosisStatusEnum.ERROR,
            errorMessage: message,
            analyzedAt: new Date(),
          });

          screening.status = ScreeningStatusEnum.AI_FAILED;
          await manager.save(screening);

          throw new InternalServerErrorException(
            SCREENING_ERRORS.AI_ANALYSIS_FAILED,
          );
        }
      },
    );
  }

  private async callPulmoAiPredictWithRetry(
    imageUrl: string,
  ): Promise<PulmoAiResponseDto> {
    const correlationId = this.generateCorrelationId();

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.log(
          `[${correlationId}] Attempt ${attempt}/${this.maxRetries}: Calling Pulmo AI`,
        );

        return await this.callPulmoAiPredict(imageUrl, correlationId);
      } catch (error) {
        if (attempt === this.maxRetries) {
          throw error;
        }

        const delay = 2000 * Math.pow(2, attempt - 1);
        this.logger.warn(
          `[${correlationId}] Retry ${attempt}/${this.maxRetries} after ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new InternalServerErrorException(
      SCREENING_ERRORS.AI_ANALYSIS_MAX_RETRIES,
    );
  }

  private async callPulmoAiPredict(
    imageUrl: string,
    correlationId: string,
  ): Promise<PulmoAiResponseDto> {
    const predictUrl = `${this.pulmoAiBaseUrl}/api/v2/predict`;

    try {
      const response = await firstValueFrom(
        this.httpService.post<PulmoAiResponseDto>(
          predictUrl,
          { image_url: imageUrl },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Correlation-Id': correlationId,
              'X-API-Key': this.configService.get<string>(
                'PULMO_AI_API_KEY',
                'dev-key',
              ),
            },
            timeout: 60000,
          },
        ),
      );

      this.logger.log(
        `[${correlationId}] Pulmo AI success: file_id=${response.data.file_id}`,
      );
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      if (axiosError.response) {
        this.logger.error(
          `[${correlationId}] Pulmo AI error: ${JSON.stringify(axiosError.response.data)}`,
        );
        throw new Error(axiosError.response.data?.error || SCREENING_ERRORS.PULMO_AI_ERROR);
      }
      throw error;
    }
  }

  private mapPulmoAiToEntity(
    response: PulmoAiResponseDto,
  ): Partial<AiAnalysis> {
    if (!response.success) {
      return {
        diagnosisStatus: AiDiagnosisStatusEnum.ERROR,
        errorMessage: response.error || SCREENING_ERRORS.PULMO_AI_UNKNOWN_ERROR,
      };
    }

    const data = response.data;
    if (!data) {
      return {
        diagnosisStatus: AiDiagnosisStatusEnum.UNCERTAIN,
        totalFindings: 0,
      };
    }

    let diagnosisStatus: AiDiagnosisStatusEnum;
    switch (data.diagnosis_status) {
      case 'DETECTED':
        diagnosisStatus = AiDiagnosisStatusEnum.DETECTED;
        break;
      case 'UNCERTAIN':
        diagnosisStatus = AiDiagnosisStatusEnum.UNCERTAIN;
        break;
      default:
        diagnosisStatus = AiDiagnosisStatusEnum.UNCERTAIN;
    }

    const primaryDiagnosis: AiPrimaryDiagnosis | undefined =
      data.primary_diagnosis
        ? {
            label: data.primary_diagnosis.label,
            name_vn: data.primary_diagnosis.name_vn,
            risk_level: data.primary_diagnosis.risk_level,
            confidence_level: data.primary_diagnosis.confidence_level,
            recommendation: data.primary_diagnosis.recommendation,
            color: data.primary_diagnosis.color,
            probability: data.primary_diagnosis.probability,
          }
        : undefined;

    const findings: AiFinding[] = (data.findings || []).map((f) => ({
      label: f.label,
      name_vn: f.name_vn,
      probability: f.probability,
      risk_level: f.risk_level,
      confidence_level: f.confidence_level,
      recommendation: f.recommendation,
      bbox: f.bbox
        ? {
            x1: f.bbox.x1,
            y1: f.bbox.y1,
            x2: f.bbox.x2,
            y2: f.bbox.y2,
          }
        : undefined,
    }));

    const grayZoneNotes: AiGrayZoneNote[] = (data.gray_zone_notes || []).map(
      (g) => ({
        label: g.label,
        name_vn: g.name_vn,
        probability: g.probability,
        required_threshold: g.required_threshold,
        bbox: g.bbox
          ? {
              x1: g.bbox.x1,
              y1: g.bbox.y1,
              x2: g.bbox.x2,
              y2: g.bbox.y2,
            }
          : undefined,
      }),
    );

    return {
      pulmoFileId: response.file_id,
      diagnosisStatus,
      primaryDiagnosis,
      findings,
      grayZoneNotes,
      totalFindings: data.total_findings || findings.length,
      originalImageUrl: response.original_image_url,
      annotatedImageUrl: response.annotated_image_url,
      evaluatedImageUrl: response.evaluated_image_url,
      predictedCondition: primaryDiagnosis?.label || 'Unknown',
      confidenceScore: primaryDiagnosis?.probability || 0,
      rawPredictions: data as unknown as Record<string, unknown>,
    };
  }

  async findAiAnalysisById(analysisId: string): Promise<AiAnalysis> {
    const analysis = await this.aiAnalysisRepository.findOne({
      where: { id: analysisId },
      relations: ['screening', 'medicalImage'],
    });
    if (!analysis) {
      throw new NotFoundException(
        SCREENING_ERRORS.AI_ANALYSIS_NOT_FOUND,
      );
    }
    return analysis;
  }

  async findAiAnalysesByScreening(screeningId: string): Promise<AiAnalysis[]> {
    return this.aiAnalysisRepository.find({
      where: { screeningId },
      order: { analyzedAt: 'DESC' },
    });
  }

  private generateCorrelationId(): string {
    return `ai-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
