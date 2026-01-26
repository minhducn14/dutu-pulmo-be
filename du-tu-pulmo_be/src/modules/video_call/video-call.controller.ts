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
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { DailyService } from './daily.service';
import { CallStateService } from './call-state.service';
import { AppointmentService } from '../appointment/appointment.service';
import {
  CreateRoomDto,
  JoinCallDto,
  RoomResponseDto,
  JoinCallResponseDto,
  CallStatusResponseDto,
  LeaveCallResponseDto,
} from './dto';
import { AppointmentTypeEnum } from '../common/enums/appointment-type.enum';

@ApiTags('Video Call')
@Controller('video-call')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VideoCallController {
  constructor(
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
    private readonly appointmentService: AppointmentService,
  ) {}

}
