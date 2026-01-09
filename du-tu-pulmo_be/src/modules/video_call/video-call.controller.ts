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

  @Post('room')
  @ApiOperation({ summary: 'Tạo hoặc lấy phòng họp cho cuộc hẹn' })
  @ApiResponse({
    status: 200,
    description: 'Phòng họp đã được tạo hoặc lấy thành công',
    type: RoomResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy cuộc hẹn' })
  @ApiResponse({ status: 400, description: 'Cuộc hẹn không phải loại VIDEO' })
  async createOrGetRoom(
    @Body() createRoomDto: CreateRoomDto,
  ): Promise<RoomResponseDto> {
    // Verify appointment exists and is VIDEO type
    const appointment = await this.appointmentService.findOne(
      createRoomDto.appointmentId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.appointmentType !== AppointmentTypeEnum.VIDEO) {
      throw new BadRequestException(
        'This appointment is not a video call appointment',
      );
    }

    // Create or get Daily.co room
    const room = await this.dailyService.getOrCreateRoom(
      createRoomDto.appointmentId,
    );

    // Update appointment with room info if not already set
    if (!appointment.meetingRoomId) {
      await this.appointmentService.update(appointment.id, {
        meetingRoomId: room.id,
        meetingUrl: room.url,
        dailyCoChannel: room.name,
      });
    }

    return {
      id: room.id,
      name: room.name,
      url: room.url,
    };
  }

  @Post('join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tham gia cuộc gọi video' })
  @ApiResponse({
    status: 200,
    description: 'Tham gia cuộc gọi thành công',
    type: JoinCallResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'User đang ở trong cuộc gọi khác',
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy cuộc hẹn' })
  async joinCall(
    @CurrentUser() user: JwtUser,
    @Body() joinCallDto: JoinCallDto,
  ): Promise<JoinCallResponseDto> {
    const userId = user.userId;

    // Check if user is already in another call
    const existingCall = await this.callStateService.getCurrentCall(userId);
    if (
      existingCall &&
      existingCall.appointmentId !== joinCallDto.appointmentId
    ) {
      throw new ConflictException({
        error: 'User is already in another call',
        appointmentId: existingCall.appointmentId,
        roomName: existingCall.roomName,
      });
    }

    // Verify appointment exists
    const appointment = await this.appointmentService.findOne(
      joinCallDto.appointmentId,
    );

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.appointmentType !== AppointmentTypeEnum.VIDEO) {
      throw new BadRequestException(
        'This appointment is not a video call appointment',
      );
    }

    // Get or create room
    const room = await this.dailyService.getOrCreateRoom(
      joinCallDto.appointmentId,
    );

    // Determine if user is the doctor (owner) or patient
    const isDoctor =
      appointment.doctorId === user.userId ||
      user.doctorId === appointment.doctorId;

    // Create meeting token
    const tokenResponse = await this.dailyService.createMeetingToken(
      room.name,
      userId,
      user.fullName || 'Guest',
      isDoctor,
    );

    // Update call state
    await this.callStateService.setCurrentCall(
      userId,
      joinCallDto.appointmentId,
      room.name,
    );

    // Update appointment with room info if needed
    if (!appointment.meetingRoomId) {
      await this.appointmentService.update(appointment.id, {
        meetingRoomId: room.id,
        meetingUrl: room.url,
        dailyCoChannel: room.name,
      });
    }

    return {
      roomUrl: room.url,
      roomName: room.name,
      token: tokenResponse.token,
      appointmentId: joinCallDto.appointmentId,
    };
  }

  @Post('leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rời khỏi cuộc gọi video' })
  @ApiResponse({
    status: 200,
    description: 'Rời cuộc gọi thành công',
    type: LeaveCallResponseDto,
  })
  async leaveCall(@CurrentUser() user: JwtUser): Promise<LeaveCallResponseDto> {
    await this.callStateService.clearCurrentCall(user.userId);
    return { message: 'Left the call successfully' };
  }

  @Get('status')
  @ApiOperation({ summary: 'Lấy trạng thái cuộc gọi hiện tại của user' })
  @ApiResponse({
    status: 200,
    description: 'Trạng thái cuộc gọi',
    type: CallStatusResponseDto,
  })
  async getCallStatus(
    @CurrentUser() user: JwtUser,
  ): Promise<CallStatusResponseDto> {
    const currentCall = await this.callStateService.getCurrentCall(user.userId);

    if (!currentCall) {
      return { inCall: false };
    }

    return {
      inCall: true,
      appointmentId: currentCall.appointmentId,
      roomName: currentCall.roomName,
      joinedAt: currentCall.joinedAt,
    };
  }
}
