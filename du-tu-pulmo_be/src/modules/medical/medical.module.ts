import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentModule } from '@/modules/appointment/appointment.module';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { VitalSign } from '@/modules/medical/entities/vital-sign.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import { PrescriptionItem } from '@/modules/medical/entities/prescription-item.entity';
import { Medicine } from '@/modules/medical/entities/medicine.entity';
import { MedicalService } from '@/modules/medical/medical.service';
import { MedicineService } from '@/modules/medical/medicine.service';
import { MedicalController } from '@/modules/medical/medical.controller';
import { MedicineController } from '@/modules/medical/medicine.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalRecord,
      VitalSign,
      Prescription,
      PrescriptionItem,
      Medicine,
    ]),
    forwardRef(() => AppointmentModule),
  ],
  controllers: [MedicalController, MedicineController],
  providers: [MedicalService, MedicineService],
  exports: [MedicalService, MedicineService, TypeOrmModule],
})
export class MedicalModule {}
