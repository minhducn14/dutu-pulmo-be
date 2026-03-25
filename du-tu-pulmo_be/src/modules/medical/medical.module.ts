import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentModule } from '@/modules/appointment/appointment.module';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { VitalSign } from '@/modules/medical/entities/vital-sign.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import { PrescriptionItem } from '@/modules/medical/entities/prescription-item.entity';
import { Medicine } from '@/modules/medical/entities/medicine.entity';
import { MedicalRecordAuditLog } from '@/modules/medical/entities/medical-record-audit-log.entity';
import { MedicalService } from '@/modules/medical/medical.service';
import { MedicineService } from '@/modules/medical/medicine.service';
import { MedicalController } from '@/modules/medical/medical.controller';
import { MedicineController } from '@/modules/medical/medicine.controller';
import { ScreeningRequest } from '@/modules/screening/entities/screening-request.entity';
import { PdfModule } from '@/modules/pdf/pdf.module';
import { NotificationModule } from '@/modules/notification/notification.module';
import { MedicalAuditService } from './medical-audit.service';
import { MedicalAuditListener } from './medical-audit.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalRecord,
      MedicalRecordAuditLog,
      VitalSign,
      Prescription,
      PrescriptionItem,
      Medicine,
      ScreeningRequest,
    ]),
    forwardRef(() => AppointmentModule),
    forwardRef(() => PdfModule),
    NotificationModule,
  ],
  controllers: [MedicalController, MedicineController],
  providers: [
    MedicalService,
    MedicineService,
    MedicalAuditService,
    MedicalAuditListener,
  ],
  exports: [
    MedicalService,
    MedicineService,
    MedicalAuditService,
    TypeOrmModule,
  ],
})
export class MedicalModule {}
