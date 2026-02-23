import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PdfService } from '@/modules/pdf/pdf.service';
import { CloudinaryModule } from '@/modules/cloudinary/cloudinary.module';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalRecord, Prescription]),
    CloudinaryModule,
  ],
  providers: [PdfService],
  exports: [PdfService],
})
export class PdfModule {}
