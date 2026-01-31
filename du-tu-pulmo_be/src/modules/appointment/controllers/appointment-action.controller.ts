
import {
  Controller,
  Post,
  Put,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  HttpCode,
  ForbiddenException,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AppointmentService } from '@/modules/appointment/services/appointment.service';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { CreateAppointmentDto } from '@/modules/appointment/dto/create-appointment.dto';
import {
  UpdateStatusDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
} from '@/modules/appointment/dto/update-appointment.dto';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Appointment Actions')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AppointmentActionController {
  constructor(
    private readonly appointmentService: AppointmentService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo lịch hẹn mới' })
  @ApiResponse({ status: HttpStatus.CREATED, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dữ liệu không hợp lệ',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Trùng lịch hoặc slot đã đầy',
  })
  async create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    if (
      user.roles?.includes(RoleEnum.PATIENT) &&
      !user.roles?.includes(RoleEnum.ADMIN)
    ) {
      if (!user.patientId) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }
      if (!dto.patientId) {
        dto.patientId = user.patientId;
      }
    }

    const response = await this.appointmentService.create({
      ...dto,
      bookedByUserId: user.id,
    });
    return this.wrapAppointment(response);
  }

  @Put(':id/status')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Cập nhật trạng thái lịch hẹn' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Trạng thái không hợp lệ',
  })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    if (
      dto.status === AppointmentStatusEnum.IN_PROGRESS ||
      dto.status === AppointmentStatusEnum.COMPLETED
    ) {
      throw new BadRequestException(
        'Vui lòng sử dụng API /start-examination hoặc /complete-examination để thay đổi trạng thái này',
      );
    }

    if (
      user.roles?.includes(RoleEnum.DOCTOR) &&
      !user.roles?.includes(RoleEnum.ADMIN)
    ) {
      const result = await this.appointmentService.findById(id);
      if (result.data!.doctor.id !== user.doctorId) {
        throw new ForbiddenException(
          'Bạn chỉ có thể cập nhật lịch hẹn của mình',
        );
      }
    }
    const response = await this.appointmentService.updateStatus(id, dto.status);
    return this.wrapAppointment(response);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Hủy lịch hẹn' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể hủy lịch hẹn',
  })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (
        user.roles?.includes(RoleEnum.PATIENT) &&
        appointment.patient.id !== user.patientId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể hủy lịch hẹn của mình');
      }
      if (
        user.roles?.includes(RoleEnum.DOCTOR) &&
        appointment.doctor.id !== user.doctorId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể hủy lịch hẹn của mình');
      }
    }

    let cancelledBy = 'SYSTEM';
    if (user.roles?.includes(RoleEnum.PATIENT)) cancelledBy = 'PATIENT';
    else if (user.roles?.includes(RoleEnum.DOCTOR)) cancelledBy = 'DOCTOR';
    else if (user.roles?.includes(RoleEnum.ADMIN)) cancelledBy = 'ADMIN';

    const response = await this.appointmentService.cancel(
      id,
      dto.reason,
      cancelledBy,
    );
    return this.wrapAppointment(response);
  }

  @Put(':id/reschedule')
  @ApiOperation({ summary: 'Đổi lịch hẹn sang time slot khác' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể đổi lịch',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Slot mới không khả dụng',
  })
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (
        user.roles?.includes(RoleEnum.PATIENT) &&
        appointment.patient.id !== user.patientId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể đổi lịch của mình');
      }
      if (
        user.roles?.includes(RoleEnum.DOCTOR) &&
        appointment.doctor.id !== user.doctorId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể đổi lịch của mình');
      }
    }

    const response = await this.appointmentService.reschedule(
      id,
      dto.newTimeSlotId,
    );
    return this.wrapAppointment(response);
  }

  @Post(':id/payment/confirm')
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Xác nhận thanh toán (Admin/Webhook)' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể xác nhận thanh toán',
  })
  async confirmPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { paymentId: string; paidAmount?: string },
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const response = await this.appointmentService.confirmPayment(
      id,
      dto.paymentId,
      dto.paidAmount,
    );
    return this.wrapAppointment(response);
  }

  private wrapAppointment(
    response: ResponseCommon<AppointmentResponseDto>,
  ): ResponseCommon<AppointmentResponseDto> {
    return new ResponseCommon(
      response.code,
      response.message,
      AppointmentResponseDto.fromData(response.data as AppointmentResponseDto),
    );
  }
}
