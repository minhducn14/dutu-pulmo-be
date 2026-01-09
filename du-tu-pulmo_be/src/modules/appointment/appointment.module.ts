import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { AppointmentService } from './appointment.service';
import { AppointmentController } from './appointment.controller';
import { TimeSlot } from '../doctor/entities/time-slot.entity';
import { VideoCallModule } from '../video_call/video-call.module';

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
