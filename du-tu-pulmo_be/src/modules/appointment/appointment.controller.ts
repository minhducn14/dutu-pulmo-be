import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  HttpCode,
  ForbiddenException,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AppointmentService } from './appointment.service';
import { AppointmentStatusEnum } from '../common/enums/appointment-status.enum';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { JwtUser } from '../core/auth/strategies/jwt.strategy';
import { RoleEnum } from '../common/enums/role.enum';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import {
  UpdateStatusDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  CompleteExaminationDto,
} from './dto/update-appointment.dto';
import {
  AppointmentResponseDto,
  AppointmentStatisticsDto,
  DoctorQueueDto,
  PaginatedAppointmentResponseDto,
} from './dto/appointment-response.dto';
import {
  AppointmentQueryDto,
  PatientAppointmentQueryDto,
} from './dto/appointment-query.dto';
import { AppointmentTypeEnum } from '../common/enums/appointment-type.enum';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Get()
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({
    summary: 'Lấy tất cả lịch hẹn (Admin)',
    description: 'Hỗ trợ phân trang và lọc theo status, type, date range',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  findAll(@Query() query: AppointmentQueryDto) {
    return this.appointmentService.findAll(query);
  }

  @Get('my/patient')
  @Roles(RoleEnum.PATIENT)
  @ApiOperation({
    summary: 'Lấy lịch hẹn của bệnh nhân hiện tại',
    description: 'Hỗ trợ phân trang và lọc theo status',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  findMyAppointmentsAsPatient(
    @CurrentUser() user: JwtUser,
    @Query() query: PatientAppointmentQueryDto,
  ) {
    if (!user.patientId) {
      throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
    }
    return this.appointmentService.findByPatient(user.patientId, query);
  }


  @Get('patient/:patientId')
  @ApiOperation({
    summary: 'Lấy lịch hẹn của bệnh nhân',
    description: 'Hỗ trợ phân trang và lọc theo status',
  })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: PatientAppointmentQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    if (
      !user.roles?.includes(RoleEnum.ADMIN) &&
      !user.roles?.includes(RoleEnum.DOCTOR)
    ) {
      if (user.patientId !== patientId) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
      }
    }
    return this.appointmentService.findByPatient(patientId, query);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({
    summary: 'Lấy lịch hẹn của bác sĩ',
    description: 'Hỗ trợ phân trang và lọc theo status',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  findByDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() query: PatientAppointmentQueryDto,
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.DOCTOR)) {
        if (user.doctorId !== doctorId) {
          throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
        }
      } else {
        throw new ForbiddenException('Không có quyền truy cập');
      }
    }
    return this.appointmentService.findByDoctor(doctorId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết lịch hẹn' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy lịch hẹn',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (
        user.roles?.includes(RoleEnum.PATIENT) &&
        appointment.patientId !== user.patientId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
      }
      if (
        user.roles?.includes(RoleEnum.DOCTOR) &&
        appointment.doctorId !== user.doctorId
      ) {
        throw new ForbiddenException(
          'Bạn chỉ có thể xem lịch hẹn của bệnh nhân bạn khám',
        );
      }
    }

    return result;
  }

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
  create(@Body() dto: CreateAppointmentDto, @CurrentUser() user: JwtUser) {
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

    return this.appointmentService.create({
      ...dto,
      bookedByUserId: user.id,
    });
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
  ) {
    if (
      user.roles?.includes(RoleEnum.DOCTOR) &&
      !user.roles?.includes(RoleEnum.ADMIN)
    ) {
      const result = await this.appointmentService.findById(id);
      if (result.data!.doctorId !== user.doctorId) {
        throw new ForbiddenException(
          'Bạn chỉ có thể cập nhật lịch hẹn của mình',
        );
      }
    }
    return this.appointmentService.updateStatus(id, dto.status);
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
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (
        user.roles?.includes(RoleEnum.PATIENT) &&
        appointment.patientId !== user.patientId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể hủy lịch hẹn của mình');
      }
      if (
        user.roles?.includes(RoleEnum.DOCTOR) &&
        appointment.doctorId !== user.doctorId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể hủy lịch hẹn của mình');
      }
    }

    let cancelledBy = 'SYSTEM';
    if (user.roles?.includes(RoleEnum.PATIENT)) cancelledBy = 'PATIENT';
    else if (user.roles?.includes(RoleEnum.DOCTOR)) cancelledBy = 'DOCTOR';
    else if (user.roles?.includes(RoleEnum.ADMIN)) cancelledBy = 'ADMIN';

    return this.appointmentService.cancel(id, dto.reason, cancelledBy);
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
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (
        user.roles?.includes(RoleEnum.PATIENT) &&
        appointment.patientId !== user.patientId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể đổi lịch của mình');
      }
      if (
        user.roles?.includes(RoleEnum.DOCTOR) &&
        appointment.doctorId !== user.doctorId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể đổi lịch của mình');
      }
    }

    return this.appointmentService.reschedule(id, dto.newTimeSlotId);
  }

  // ============================================================================
  // CÁC ENDPOINT THANH TOÁN
  // ============================================================================

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
  ) {
    return this.appointmentService.confirmPayment(
      id,
      dto.paymentId,
      dto.paidAmount,
    );
  }

}
