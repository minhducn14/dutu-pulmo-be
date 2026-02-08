import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScreeningRequest } from '@/modules/screening/entities/screening-request.entity';
import { MedicalImage } from '@/modules/screening/entities/medical-image.entity';
import { AiAnalysis } from '@/modules/screening/entities/ai-analysis.entity';
import { ScreeningService } from '@/modules/screening/screening.service';
import { ScreeningController } from '@/modules/screening/screening.controller';
import { CloudinaryModule } from '@/modules/cloudinary/cloudinary.module';
import { FileValidationService } from '@/modules/screening/file-validation.service';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { PatientModule } from '@/modules/patient/patient.module';
import { ScreeningConclusion } from '@/modules/screening/entities/screening-conclusion.entity';
import { MedicalRecord } from '../medical/entities/medical-record.entity';

@Module({
  imports: [
    HttpModule,
    CloudinaryModule,
    PatientModule,
    TypeOrmModule.forFeature([
      ScreeningRequest,
      MedicalImage,
      AiAnalysis,
      ScreeningConclusion,
      Patient,
      MedicalRecord
    ]),
  ],
  controllers: [ScreeningController],
  providers: [ScreeningService, FileValidationService],
  exports: [ScreeningService, TypeOrmModule],
})
export class ScreeningModule {}
