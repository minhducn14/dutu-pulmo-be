import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { AppointmentService } from '@/modules/appointment/appointment.service';
import {
  CreateRoomDto,
  JoinCallDto,
  RoomResponseDto,
  JoinCallResponseDto,
  CallStatusResponseDto,
  LeaveCallResponseDto,
} from '@/modules/video_call/dto';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';

@ApiTags('Video Call')
@Controller('video-call')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class VideoCallController {
  constructor(
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
    private readonly appointmentService: AppointmentService,
  ) {}
}
