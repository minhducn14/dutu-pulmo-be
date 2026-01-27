import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScreeningRequest } from './entities/screening-request.entity';
import { MedicalImage } from './entities/medical-image.entity';
import { AiAnalysis } from './entities/ai-analysis.entity';
import { ScreeningService } from './screening.service';
import { ScreeningController } from './screening.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { FileValidationService } from './file-validation.service';
import { Patient } from '../patient/entities/patient.entity';
import { PatientModule } from '../patient/patient.module';
import { ScreeningConclusion } from './entities/screening-conclusion.entity';

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
    ]),
  ],
  controllers: [ScreeningController],
  providers: [ScreeningService, FileValidationService],
  exports: [ScreeningService, TypeOrmModule],
})
export class ScreeningModule {}
