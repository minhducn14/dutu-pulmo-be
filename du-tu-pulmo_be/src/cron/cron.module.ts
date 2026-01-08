import { Module } from '@nestjs/common';
import { DoctorModule } from '../modules/doctor/doctor.module';
import { SlotSchedulerService } from './slot-scheduler.service';

@Module({
  imports: [
    DoctorModule,
  ],
  providers: [
    SlotSchedulerService,
  ],
  exports: [
    SlotSchedulerService,
  ],
})
export class CronModule {}

