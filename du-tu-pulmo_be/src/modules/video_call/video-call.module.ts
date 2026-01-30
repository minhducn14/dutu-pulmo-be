import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VideoCallController } from '@/modules/video_call/video-call.controller';
import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { AppointmentModule } from '@/modules/appointment/appointment.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
    forwardRef(() => AppointmentModule),
  ],
  controllers: [VideoCallController],
  providers: [DailyService, CallStateService],
  exports: [DailyService, CallStateService],
})
export class VideoCallModule {}
