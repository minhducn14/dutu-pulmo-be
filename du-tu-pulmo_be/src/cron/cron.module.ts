import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorModule } from '@/modules/doctor/doctor.module';
import { SlotSchedulerService } from '@/cron/slot-scheduler.service';
import { AppointmentSchedulerService } from '@/cron/appointment-scheduler.service';
import { PaymentSchedulerService } from '@/cron/payment-scheduler.service';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { VideoCallModule } from '@/modules/video_call/video-call.module';
import { PaymentModule } from '@/modules/payment/payment.module';
import { AppointmentModule } from '@/modules/appointment/appointment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Appointment, TimeSlot, MedicalRecord]),
    DoctorModule,
    forwardRef(() => VideoCallModule),
    PaymentModule,
    AppointmentModule,
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
