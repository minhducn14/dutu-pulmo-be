import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { ActiveCallEntity } from '@/modules/video_call/entities/active-call.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActiveCallEntity]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  controllers: [],
  providers: [DailyService, CallStateService],
  exports: [DailyService, CallStateService],
})
export class VideoCallModule {}
