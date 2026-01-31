import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentService } from '@/modules/appointment/services/appointment.service';
import { AppointmentReadController } from '@/modules/appointment/controllers/appointment-read.controller';
import { AppointmentActionController } from '@/modules/appointment/controllers/appointment-action.controller';

import { AppointmentReadService } from '@/modules/appointment/services/appointment-read.service';
import { AppointmentEntityService } from '@/modules/appointment/services/appointment-entity.service';
import { AppointmentCreateService } from '@/modules/appointment/services/appointment-create.service';
import { AppointmentSchedulingService } from '@/modules/appointment/services/appointment-scheduling.service';
import { AppointmentStatusService } from '@/modules/appointment/services/appointment-status.service';
import { AppointmentMapperService } from '@/modules/appointment/services/appointment-mapper.service';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { VideoCallModule } from '@/modules/video_call/video-call.module';
import { MedicalModule } from '@/modules/medical/medical.module';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Patient } from '@/modules/patient/entities/patient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, TimeSlot, Doctor, Patient]),
    forwardRef(() => VideoCallModule),
    forwardRef(() => MedicalModule),
  ],
  controllers: [
    AppointmentReadController,
    AppointmentActionController,
  ],
  providers: [
    AppointmentService,

    AppointmentReadService,
    AppointmentEntityService,
    AppointmentCreateService,
    AppointmentSchedulingService,
    AppointmentStatusService,
    AppointmentMapperService,
  ],
  exports: [AppointmentService, TypeOrmModule],
})
export class AppointmentModule {}
