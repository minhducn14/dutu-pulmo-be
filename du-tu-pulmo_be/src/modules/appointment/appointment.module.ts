import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentService } from '@/modules/appointment/services/appointment.service';
import { AppointmentReadController } from '@/modules/appointment/controllers/appointment-read.controller';
import { AppointmentActionController } from '@/modules/appointment/controllers/appointment-action.controller';
import { AppointmentStatsController } from '@/modules/appointment/controllers/appointment-stats.controller';
import { AppointmentMedicalAccessService } from '@/modules/appointment/services/appointment-medical-access.service';

import { AppointmentReadService } from '@/modules/appointment/services/appointment-read.service';
import { AppointmentStatsService } from '@/modules/appointment/services/appointment-stats.service';
import { AppointmentCalendarService } from '@/modules/appointment/services/appointment-calendar.service';
import { AppointmentEntityService } from '@/modules/appointment/services/appointment-entity.service';
import { AppointmentCheckinService } from '@/modules/appointment/services/appointment-checkin.service';
import { AppointmentCreateService } from '@/modules/appointment/services/appointment-create.service';
import { AppointmentSchedulingService } from '@/modules/appointment/services/appointment-scheduling.service';
import { AppointmentStatusService } from '@/modules/appointment/services/appointment-status.service';
import { AppointmentVideoService } from '@/modules/appointment/services/appointment-video.service';
import { AppointmentMapperService } from '@/modules/appointment/services/appointment-mapper.service';
import { DashboardStatsService } from '@/modules/appointment/services/dashboard-stats.service';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { VideoCallModule } from '@/modules/video_call/video-call.module';
import { MedicalModule } from '@/modules/medical/medical.module';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { Payment } from '@/modules/payment/entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, TimeSlot, Doctor, Patient, Payment]),
    forwardRef(() => VideoCallModule),
    forwardRef(() => MedicalModule),
  ],
  controllers: [
    AppointmentReadController,
    AppointmentActionController,
    AppointmentStatsController,
  ],
  providers: [
    AppointmentService,
    AppointmentMedicalAccessService,

    AppointmentReadService,
    AppointmentStatsService,
    AppointmentCalendarService,
    AppointmentEntityService,
    AppointmentCheckinService,
    AppointmentCreateService,
    AppointmentSchedulingService,
    AppointmentStatusService,
    AppointmentVideoService,
    AppointmentMapperService,
    DashboardStatsService,
  ],
  exports: [AppointmentService, TypeOrmModule],
})
export class AppointmentModule {}
