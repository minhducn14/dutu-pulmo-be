import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentService } from '@/modules/appointment/appointment.service';
import { AppointmentController } from '@/modules/appointment/appointment.controller';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { VideoCallModule } from '@/modules/video_call/video-call.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, TimeSlot]),
    forwardRef(() => VideoCallModule),
  ],
  controllers: [AppointmentController],
  providers: [AppointmentService],
  exports: [AppointmentService, TypeOrmModule],
})
export class AppointmentModule {}
