import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { PatientService } from '@/modules/patient/patient.service';
import { PatientController } from '@/modules/patient/patient.controller';
import { AppointmentModule } from '@/modules/appointment/appointment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Patient]),
    forwardRef(() => AppointmentModule),
  ],
  controllers: [PatientController],
  providers: [PatientService],
  exports: [PatientService, TypeOrmModule],
})
export class PatientModule {}
