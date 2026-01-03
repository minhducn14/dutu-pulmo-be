import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { Account } from '../account/entities/account.entity';
import { SubSpecialty } from '../specialty/entities/sub-specialty.entity';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Doctor, DoctorSchedule, TimeSlot, Account, SubSpecialty]),
    CloudinaryModule,
  ],
  controllers: [DoctorController],
  providers: [DoctorService],
  exports: [DoctorService, TypeOrmModule],
})
export class DoctorModule {}


