// import {
//   Controller,
//   Post,
//   Get,
//   Body,
//   UseGuards,
//   HttpCode,
//   HttpStatus,
//   ConflictException,
//   NotFoundException,
//   BadRequestException,
//   ForbiddenException,
// } from '@nestjs/common';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiResponse,
//   ApiBearerAuth,
// } from '@nestjs/swagger';
// import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
// import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
// import { Roles } from '@/common/decorators/roles.decorator';
// import { CurrentUser } from '@/common/decorators/user.decorator';
// import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
// import { DailyService } from '@/modules/video_call/daily.service';
// import { CallStateService } from '@/modules/video_call/call-state.service';
// import { AppointmentService } from '@/modules/appointment/services/appointment.service';
// import {
//   CreateRoomDto,
//   JoinCallDto,
//   RoomResponseDto,
//   JoinCallResponseDto,
//   CallStatusResponseDto,
//   LeaveCallResponseDto,
// } from '@/modules/video_call/dto';
// import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
// import { RoleEnum } from '@/modules/common/enums/role.enum';
// import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

// @ApiTags('Video Call')
// @Controller('video-call')
// @UseGuards(JwtAuthGuard)
// @ApiBearerAuth('JWT-auth')
// export class VideoCallController {
//   constructor(
//     private readonly dailyService: DailyService,
//     private readonly callStateService: CallStateService,
//     private readonly appointmentService: AppointmentService,
//   ) {}

//   @Post('room')
//   @UseGuards(RolesGuard)
//   @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
//   @ApiOperation({ summary: 'Tạo phòng họp cho cuộc hẹn (Chỉ Doctor/Admin) - Optional, có thể dùng /join trực tiếp' })
//   @ApiResponse({
//     status: 200,
//     description: 'Phòng họp đã được tạo thành công',
//     type: RoomResponseDto,
//   })
//   @ApiResponse({ status: 403, description: 'Chỉ Doctor/Admin mới có thể tạo phòng' })
//   @ApiResponse({ status: 404, description: 'Không tìm thấy cuộc hẹn' })
//   @ApiResponse({ status: 400, description: 'Cuộc hẹn không phải loại VIDEO' })
//   async rGetRoom(
//     @CurrentUser() user: JwtUser,
//     @Body() createRoomDto: CreateRoomDto,
//   ): Promise<RoomResponseDto> {
//     const appointment = await this.appointmentService.findOne(
//       createRoomDto.appointmentId,
//     );

//     if (!appointment) {
//       throw new NotFoundException('Appointment not found');
//     }

//     if (appointment.appointmentType !== AppointmentTypeEnum.VIDEO) {
//       throw new BadRequestException(
//         'This appointment is not a video call appointment',
//       );
//     }

//     const isDoctor =
//       appointment.doctorId === user.userId ||
//       user.doctorId === appointment.doctorId;

//     if (!isDoctor && !user.roles?.includes(RoleEnum.ADMIN)) {
//       throw new ForbiddenException(
//         ERROR_MESSAGES.ACCESS_DENIED_VIDEO_CALL,
//       );
//     }

//     const roomName = `appointment-${createRoomDto.appointmentId}`;
//     let room = await this.dailyService.getRoom(roomName);

//     if (!room) {
//       room = await this.dailyService.createRoom(roomName);

//       await this.appointmentService.update(appointment.id, {
//         meetingRoomId: room.id,
//         meetingUrl: room.url,
//         dailyCoChannel: room.name,
//       });
//     }

//     return {
//       id: room.id,
//       name: room.name,
//       url: room.url,
//     };
//   }

//   @Post('join')
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({
//     summary: 'Tham gia cuộc gọi video',
//     description: 'Bác sĩ: Tự động tạo phòng và join nếu chưa có. Bệnh nhân: Chỉ join nếu phòng đã được tạo.'
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Tham gia cuộc gọi thành công',
//     type: JoinCallResponseDto,
//   })
//   @ApiResponse({
//     status: 409,
//     description: 'User đang ở trong cuộc gọi khác',
//   })
//   @ApiResponse({ status: 404, description: 'Không tìm thấy cuộc hẹn hoặc phòng họp chưa được tạo (dành cho bệnh nhân)' })
//   @ApiResponse({ status: 403, description: 'Không có quyền tham gia cuộc gọi này' })
//   async joinCall(
//     @CurrentUser() user: JwtUser,
//     @Body() joinCallDto: JoinCallDto,
//   ): Promise<JoinCallResponseDto> {
//     const userId = user.userId;

//     const existingCall = await this.callStateService.getCurrentCall(userId);
//     if (
//       existingCall &&
//       existingCall.appointmentId !== joinCallDto.appointmentId
//     ) {
//       throw new ConflictException({
//         error: ERROR_MESSAGES.USER_ALREADY_IN_CALL,
//         appointmentId: existingCall.appointmentId,
//         roomName: existingCall.roomName,
//       });
//     }

//     const appointment = await this.appointmentService.findOne(
//       joinCallDto.appointmentId,
//     );

//     if (!appointment) {
//       throw new NotFoundException('Appointment not found');
//     }

//     if (appointment.appointmentType !== AppointmentTypeEnum.VIDEO) {
//       throw new BadRequestException(
//         'This appointment is not a video call appointment',
//       );
//     }

//     const isDoctor =
//       appointment.doctorId === user.userId ||
//       user.doctorId === appointment.doctorId;

//     const isPatient = appointment.patientId === user.userId;

//     if (!isDoctor && !isPatient && !user.roles?.includes(RoleEnum.ADMIN)) {
//       throw new ForbiddenException(
//         ERROR_MESSAGES.ACCESS_DENIED_VIDEO_CALL,
//       );
//     }

//     const roomName = `appointment-${joinCallDto.appointmentId}`;
//     let room = await this.dailyService.getRoom(roomName);

//     if (!room) {
//       if (isPatient) {
//         throw new BadRequestException(
//           ERROR_MESSAGES.VIDEO_CALL_NOT_STARTED,
//         );
//       } else {
//         room = await this.dailyService.createRoom(roomName);

//         await this.appointmentService.update(appointment.id, {
//           meetingRoomId: room.id,
//           meetingUrl: room.url,
//           dailyCoChannel: room.name,
//         });
//       }
//     }

//     const tokenResponse = await this.dailyService.createMeetingToken(
//       room.name,
//       userId,
//       user.fullName || 'Guest',
//       isDoctor,
//     );

//     await this.callStateService.setCurrentCall(
//       userId,
//       joinCallDto.appointmentId,
//       room.name,
//     );

//     return {
//       roomUrl: room.url,
//       roomName: room.name,
//       token: tokenResponse.token,
//       appointmentId: joinCallDto.appointmentId,
//     };
//   }

//   @Post('leave')
//   @HttpCode(HttpStatus.OK)
//   @ApiOperation({ summary: 'Rời khỏi cuộc gọi video' })
//   @ApiResponse({
//     status: 200,
//     description: 'Rời cuộc gọi thành công',
//     type: LeaveCallResponseDto,
//   })
//   async leaveCall(@CurrentUser() user: JwtUser): Promise<LeaveCallResponseDto> {
//     await this.callStateService.clearCurrentCall(user.userId);
//     return { message: 'Left the call successfully' };
//   }

//   @Get('status')
//   @ApiOperation({ summary: 'Lấy trạng thái cuộc gọi hiện tại của user' })
//   @ApiResponse({
//     status: 200,
//     description: 'Trạng thái cuộc gọi',
//     type: CallStatusResponseDto,
//   })
//   async getCallStatus(
//     @CurrentUser() user: JwtUser,
//   ): Promise<CallStatusResponseDto> {
//     const currentCall = await this.callStateService.getCurrentCall(user.userId);

//     if (!currentCall) {
//       return { inCall: false };
//     }

//     return {
//       inCall: true,
//       appointmentId: currentCall.appointmentId,
//       roomName: currentCall.roomName,
//       joinedAt: currentCall.joinedAt,
//     };
//   }
// }
