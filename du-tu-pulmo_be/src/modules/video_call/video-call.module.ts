import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { VideoCallController } from './video-call.controller';
import { DailyService } from './daily.service';
import { CallStateService } from './call-state.service';
import { AppointmentModule } from '../appointment/appointment.module';

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
