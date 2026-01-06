import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  HttpCode,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
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
} from './dto/update-appointment.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';

@ApiTags('Appointments')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AppointmentController {
  constructor(private readonly appointmentService: AppointmentService) {}

  @Get()
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Lấy tất cả lịch hẹn (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  findAll() {
    return this.appointmentService.findAll();
  }

  @Get('my/patient')
  @Roles(RoleEnum.PATIENT)
  @ApiOperation({ summary: 'Lấy lịch hẹn của bệnh nhân hiện tại' })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  findMyAppointmentsAsPatient(@CurrentUser() user: JwtUser) {
    if (!user.patientId) {
      throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
    }
    return this.appointmentService.findByPatient(user.patientId);
  }

  @Get('my/doctor')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy lịch hẹn của bác sĩ hiện tại' })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  findMyAppointmentsAsDoctor(@CurrentUser() user: JwtUser) {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    return this.appointmentService.findByDoctor(user.doctorId);
  }

  @Get('patient/:patientId')
  @ApiOperation({ summary: 'Lấy lịch hẹn của bệnh nhân' })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Không có quyền truy cập' })
  findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.roles?.includes(RoleEnum.ADMIN) && !user.roles?.includes(RoleEnum.DOCTOR)) {
      if (user.patientId !== patientId) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
      }
    }
    return this.appointmentService.findByPatient(patientId);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({ summary: 'Lấy lịch hẹn của bác sĩ' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Không có quyền truy cập' })
  findByDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.DOCTOR) && user.doctorId !== doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
      }
      if (user.roles?.includes(RoleEnum.PATIENT)) {
        throw new ForbiddenException('Bệnh nhân không có quyền truy cập');
      }
    }
    return this.appointmentService.findByDoctor(doctorId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết lịch hẹn' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Không tìm thấy lịch hẹn' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Không có quyền truy cập' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.PATIENT) && appointment.patientId !== user.patientId) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
      }
      if (user.roles?.includes(RoleEnum.DOCTOR) && appointment.doctorId !== user.doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của bệnh nhân bạn khám');
      }
    }

    return result;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo lịch hẹn mới' })
  @ApiResponse({ status: HttpStatus.CREATED, type: AppointmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Dữ liệu không hợp lệ' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Trùng lịch hoặc slot đã đầy' })
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    // Patient can only book for themselves
    if (user.roles?.includes(RoleEnum.PATIENT) && !user.roles?.includes(RoleEnum.ADMIN)) {
      if (dto.patientId && dto.patientId !== user.patientId) {
        throw new ForbiddenException('Bạn chỉ có thể đặt lịch cho chính mình');
      }
      dto.patientId = user.patientId;
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
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Trạng thái không hợp lệ' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    if (user.roles?.includes(RoleEnum.DOCTOR) && !user.roles?.includes(RoleEnum.ADMIN)) {
      const result = await this.appointmentService.findById(id);
      if (result.data!.doctorId !== user.doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể cập nhật lịch hẹn của mình');
      }
    }
    return this.appointmentService.updateStatus(id, dto.status);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Hủy lịch hẹn' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Không thể hủy lịch hẹn' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.PATIENT) && appointment.patientId !== user.patientId) {
        throw new ForbiddenException('Bạn chỉ có thể hủy lịch hẹn của mình');
      }
      if (user.roles?.includes(RoleEnum.DOCTOR) && appointment.doctorId !== user.doctorId) {
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
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Không thể đổi lịch' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Slot mới không khả dụng' })
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.PATIENT) && appointment.patientId !== user.patientId) {
        throw new ForbiddenException('Bạn chỉ có thể đổi lịch của mình');
      }
      if (user.roles?.includes(RoleEnum.DOCTOR) && appointment.doctorId !== user.doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể đổi lịch của mình');
      }
    }

    return this.appointmentService.reschedule(id, dto.newTimeSlotId);
  }

  @Put(':id/no-show')
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Đánh dấu bệnh nhân không đến' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Không thể đánh dấu no-show' })
  async markNoShow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (user.roles?.includes(RoleEnum.DOCTOR) && !user.roles?.includes(RoleEnum.ADMIN)) {
      if (appointment.doctorId !== user.doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể đánh dấu lịch hẹn của mình');
      }
    }

    const markedBy = user.roles?.includes(RoleEnum.ADMIN) ? 'ADMIN' : 'DOCTOR';
    return this.appointmentService.markNoShow(id, markedBy);
  }
}
