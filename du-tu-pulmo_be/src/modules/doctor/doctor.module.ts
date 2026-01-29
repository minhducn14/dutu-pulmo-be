import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Account } from '@/modules/account/entities/account.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { DoctorService } from '@/modules/doctor/services/doctor.service';
import { DoctorController } from '@/modules/doctor/controllers/doctor.controller';
import { CloudinaryModule } from '@/modules/cloudinary/cloudinary.module';
import { TimeSlotService } from '@/modules/doctor/services/time-slot.service';
import { DoctorScheduleService } from '@/modules/doctor/services/doctor-schedule.service';
import { DoctorScheduleHelperService } from '@/modules/doctor/services/doctor-schedule-helper.service';
import { DoctorScheduleQueryService } from '@/modules/doctor/services/doctor-schedule-query.service';
import { DoctorScheduleFeeService } from '@/modules/doctor/services/doctor-schedule-fee.service';
import { DoctorScheduleSlotService } from '@/modules/doctor/services/doctor-schedule-slot.service';
import { DoctorScheduleUpdateService } from '@/modules/doctor/services/doctor-schedule-update.service';
import { DoctorScheduleRestoreService } from '@/modules/doctor/services/doctor-schedule-restore.service';
import { DoctorScheduleRegularService } from '@/modules/doctor/services/doctor-schedule-regular.service';
import { DoctorScheduleFlexibleService } from '@/modules/doctor/services/doctor-schedule-flexible.service';
import { DoctorScheduleTimeOffService } from '@/modules/doctor/services/doctor-schedule-timeoff.service';
import { DoctorSchedulePreviewService } from '@/modules/doctor/services/doctor-schedule-preview.service';
import { DoctorScheduleController } from '@/modules/doctor/controllers/doctor-schedule.controller';
import { TimeSlotController } from '@/modules/doctor/controllers/time-slot.controller';
import { SlotGeneratorService } from '@/modules/doctor/services/slot-generator.service';
import { PublicDoctorController } from '@/modules/doctor/controllers/public-doctor.controller';
import { NotificationModule } from '@/modules/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Doctor,
      DoctorSchedule,
      TimeSlot,
      Account,
      Appointment,
    ]),
    CloudinaryModule,
    NotificationModule,
  ],
  controllers: [
    DoctorController,
    PublicDoctorController,
    TimeSlotController,
    DoctorScheduleController,
  ],
  providers: [
    DoctorService,
    TimeSlotService,
    DoctorScheduleService,
    DoctorScheduleHelperService,
    DoctorScheduleQueryService,
    DoctorScheduleFeeService,
    DoctorScheduleSlotService,
    DoctorScheduleUpdateService,
    DoctorScheduleRestoreService,
    DoctorScheduleRegularService,
    DoctorScheduleFlexibleService,
    DoctorScheduleTimeOffService,
    DoctorSchedulePreviewService,
    SlotGeneratorService,
  ],
  exports: [
    DoctorService,
    TimeSlotService,
    DoctorScheduleService,
    SlotGeneratorService,
    TypeOrmModule,
  ],
})
export class DoctorModule {}
