import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppointmentModule } from '../appointment/appointment.module';
import { MedicalRecord } from './entities/medical-record.entity';
import { VitalSign } from './entities/vital-sign.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { Medicine } from './entities/medicine.entity';
import { MedicalService } from './medical.service';
import { MedicineService } from './medicine.service';
import { MedicalController } from './medical.controller';
import { MedicineController } from './medicine.controller';

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
