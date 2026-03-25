import { Module } from '@nestjs/common';
import { PaymentModule } from '@/modules/payment/payment.module';
import { VideoCallModule } from '@/modules/video_call/video-call.module';
import { AppointmentCancellationCoreService } from '@/modules/appointment/services/appointment-cancellation-core.service';

@Module({
  imports: [PaymentModule, VideoCallModule],
  providers: [AppointmentCancellationCoreService],
  exports: [AppointmentCancellationCoreService],
})
export class AppointmentCancellationModule {}
