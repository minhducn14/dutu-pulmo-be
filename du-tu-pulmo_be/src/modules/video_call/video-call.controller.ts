import {
  Controller,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';

@ApiTags('Video Call')
@Controller('video-call')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class VideoCallController {
  constructor(
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService
  ) {}
}
