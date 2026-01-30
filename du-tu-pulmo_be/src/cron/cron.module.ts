import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorModule } from '@/modules/doctor/doctor.module';
import { SlotSchedulerService } from '@/cron/slot-scheduler.service';
import { AppointmentSchedulerService } from '@/cron/appointment-scheduler.service';
import { PaymentSchedulerService } from '@/cron/payment-scheduler.service';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { VideoCallModule } from '@/modules/video_call/video-call.module';
import { PaymentModule } from '@/modules/payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, TimeSlot]),
    DoctorModule,
    forwardRef(() => VideoCallModule),
    PaymentModule,
  ],
  providers: [
    SlotSchedulerService,
    AppointmentSchedulerService,
    PaymentSchedulerService,
  ],
  exports: [
    SlotSchedulerService,
    AppointmentSchedulerService,
    PaymentSchedulerService,
  ],
})
export class CronModule {}
