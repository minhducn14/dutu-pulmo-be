import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from './entities/doctor.entity';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { TimeSlot } from './entities/time-slot.entity';
import { Account } from '../account/entities/account.entity';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { TimeSlotService } from './time-slot.service';
import { DoctorScheduleService } from './doctor-schedule.service';
import { DoctorScheduleController } from './doctor-schedule.controller';
import { TimeSlotController } from './time-slot.controller';
import { SlotGeneratorService } from './slot-generator.service';
import { PublicDoctorController } from './public-doctor.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Doctor, DoctorSchedule, TimeSlot, Account]),
    CloudinaryModule,
  ],
  controllers: [DoctorController, PublicDoctorController, TimeSlotController, DoctorScheduleController],
  providers: [DoctorService, TimeSlotService, DoctorScheduleService, SlotGeneratorService],
  exports: [DoctorService, TimeSlotService, DoctorScheduleService, SlotGeneratorService, TypeOrmModule],
})
export class DoctorModule {}


