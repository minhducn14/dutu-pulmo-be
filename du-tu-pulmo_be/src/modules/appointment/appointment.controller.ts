/**
 * =============================================================================
 * APPOINTMENT CONTROLLER
 * =============================================================================
 * 
 * Controller xử lý các API liên quan đến lịch hẹn khám bệnh.
 * 
 * Các chức năng chính:
 * - Quản lý lịch hẹn (tạo, xem, cập nhật, hủy)
 * - Quy trình check-in (tại phòng khám và video call)
 * - Quy trình khám bệnh (bắt đầu, hoàn thành)
 * - Quản lý hàng đợi bệnh nhân
 * - Thống kê và báo cáo
 * - Lịch khám dạng calendar
 * - Video call cho telehealth
 * - Thanh toán
 * - Thông tin lâm sàng
 * 
 * @author Dutu Pulmo Team
 */

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
import { AppointmentQueryDto, PatientAppointmentQueryDto } from './dto/appointment-query.dto';
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
    description: 'Hỗ trợ phân trang và lọc theo status, type, date range'
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  findAll(@Query() query: AppointmentQueryDto) {
    return this.appointmentService.findAll(query);
  }

  @Get('my/patient')
  @Roles(RoleEnum.PATIENT)
  @ApiOperation({ 
    summary: 'Lấy lịch hẹn của bệnh nhân hiện tại',
    description: 'Hỗ trợ phân trang và lọc theo status'
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

  @Get('my/doctor')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ 
    summary: 'Lấy lịch hẹn của bác sĩ hiện tại',
    description: 'Hỗ trợ phân trang và lọc theo status'
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  findMyAppointmentsAsDoctor(
    @CurrentUser() user: JwtUser,
    @Query() query: PatientAppointmentQueryDto,
  ) {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    return this.appointmentService.findByDoctor(user.doctorId, query);
  }

  @Post(':id/check-in')
  @Roles(RoleEnum.DOCTOR, RoleEnum.PATIENT, RoleEnum.ADMIN)
  @ApiOperation({ 
    summary: 'Check-in bệnh nhân',
    description: `
      - IN_CLINIC: Lễ tân/bác sĩ check-in khi bệnh nhân đến (30 phút trước - 15 phút sau)
      - VIDEO: Bệnh nhân/bác sĩ check-in trước khi join call (1 giờ trước - 30 phút sau)
    `
  })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể check-in (sai trạng thái, sai thời gian)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền check-in',
  })
  async checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (appointment.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      const canCheckIn = 
        user.roles?.includes(RoleEnum.ADMIN) ||
        (user.roles?.includes(RoleEnum.DOCTOR) && appointment.doctorId === user.doctorId);

      if (!canCheckIn) {
        throw new ForbiddenException(
          'Chỉ lễ tân, y tá hoặc bác sĩ mới có thể check-in cho lịch hẹn tại phòng khám',
        );
      }
    } else if (appointment.appointmentType === AppointmentTypeEnum.VIDEO) {
      const isPatient = appointment.patientId === user.patientId;
      const isDoctor = appointment.doctorId === user.doctorId;
      const isAdmin = user.roles?.includes(RoleEnum.ADMIN);

      if (!isPatient && !isDoctor && !isAdmin) {
        throw new ForbiddenException(
          'Chỉ bệnh nhân hoặc bác sĩ của cuộc hẹn mới có thể check-in',
        );
      }
    }

    return this.appointmentService.checkIn(id);
  }

  @Post(':id/check-in/video')
  @Roles(RoleEnum.PATIENT, RoleEnum.DOCTOR)
  @ApiOperation({ 
    summary: 'Check-in cho cuộc hẹn VIDEO (bệnh nhân hoặc bác sĩ)',
    description: 'Cho phép check-in trước giờ hẹn 1 tiếng để chuẩn bị join video call'
  })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không phải VIDEO appointment hoặc chưa đến giờ',
  })
  async checkInVideo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    const isPatient = appointment.patientId === user.patientId;
    const isDoctor = appointment.doctorId === user.doctorId;

    if (!isPatient && !isDoctor && !user.roles?.includes(RoleEnum.ADMIN)) {
      throw new ForbiddenException(
        'Bạn không có quyền check-in cuộc hẹn này',
      );
    }

    return this.appointmentService.checkInVideo(id);
  }

  @Get('my/doctor/checked-in')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy danh sách bệnh nhân đã check-in đang chờ khám' })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  async getCheckedInPatients(@CurrentUser() user: JwtUser) {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    return this.appointmentService.findCheckedInByDoctor(user.doctorId);
  }

  // ============================================================================
  // QUY TRÌNH KHÁM BỆNH
  // ============================================================================

  @Post(':id/start-examination')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Bác sĩ bắt đầu khám bệnh' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể bắt đầu khám (sai trạng thái)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không phải bác sĩ của cuộc hẹn này',
  })
  async startExamination(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (appointment.doctorId !== user.doctorId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể khám bệnh nhân của mình',
      );
    }

    return this.appointmentService.startExamination(id);
  }

  @Post(':id/complete-examination')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Hoàn thành khám bệnh và ghi kết quả' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể hoàn thành (sai trạng thái)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không phải bác sĩ của cuộc hẹn này',
  })
  async completeExamination(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteExaminationDto,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (appointment.doctorId !== user.doctorId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể hoàn thành khám bệnh nhân của mình',
      );
    }

    return this.appointmentService.completeExamination(id, dto);
  }

  // ============================================================================
  // QUẢN LÝ HÀNG ĐỢI
  // ============================================================================

  @Get('doctor/:doctorId/queue')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Lấy hàng đợi khám của bác sĩ' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: DoctorQueueDto })
  async getDoctorQueue(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (
      !user.roles?.includes(RoleEnum.ADMIN) &&
      user.roles?.includes(RoleEnum.DOCTOR)
    ) {
      if (user.doctorId !== doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể xem hàng đợi của mình');
      }
    }

    return this.appointmentService.getDoctorQueue(doctorId);
  }

  @Get('my/doctor/queue')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy hàng đợi khám của bác sĩ hiện tại' })
  @ApiResponse({ status: HttpStatus.OK, type: DoctorQueueDto })
  async getMyQueue(@CurrentUser() user: JwtUser) {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    return this.appointmentService.getDoctorQueue(user.doctorId);
  }

  // ============================================================================
  // THỐNG KÊ VÀ DASHBOARD
  // ============================================================================

  @Get('my/doctor/statistics')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy thống kê lịch hẹn của bác sĩ' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentStatisticsDto })
  async getMyStatistics(
    @CurrentUser() user: JwtUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    
    return this.appointmentService.getDoctorStatistics(
      user.doctorId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('my/patient/statistics')
  @Roles(RoleEnum.PATIENT)
  @ApiOperation({ summary: 'Lấy thống kê lịch hẹn của bệnh nhân' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentStatisticsDto })
  async getMyPatientStats(@CurrentUser() user: JwtUser) {
    if (!user.patientId) {
      throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
    }
    return this.appointmentService.getPatientStatistics(user.patientId);
  }

  // ============================================================================
  // LỊCH KHÁM DẠNG CALENDAR
  // ============================================================================

  @Get('doctor/:doctorId/calendar')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Lấy lịch khám theo calendar view' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  async getCalendar(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (
      !user.roles?.includes(RoleEnum.ADMIN) &&
      user.roles?.includes(RoleEnum.DOCTOR)
    ) {
      if (user.doctorId !== doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch của mình');
      }
    }

    return this.appointmentService.getCalendar(
      doctorId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('my/doctor/calendar')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy lịch khám của bác sĩ hiện tại theo calendar view' })
  @ApiQuery({ name: 'startDate', required: true, description: 'Ngày bắt đầu (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: true, description: 'Ngày kết thúc (YYYY-MM-DD)' })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  async getMyCalendar(
    @CurrentUser() user: JwtUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }

    return this.appointmentService.getCalendar(
      user.doctorId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('me/call-status')
  @ApiOperation({ summary: 'Kiểm tra trạng thái cuộc gọi hiện tại của user' })
  @ApiResponse({ status: HttpStatus.OK })
  async getMyCallStatus(@CurrentUser() user: JwtUser) {
    return this.appointmentService.getUserCallStatus(user.id);
  }

  @Get('patient/:patientId')
  @ApiOperation({ 
    summary: 'Lấy lịch hẹn của bệnh nhân',
    description: 'Hỗ trợ phân trang và lọc theo status'
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
    description: 'Hỗ trợ phân trang và lọc theo status'
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
  // CÁC ENDPOINT VIDEO CALL
  // ============================================================================

  @Get(':id/video/status')
  @ApiOperation({ 
    summary: 'Kiểm tra trạng thái video call trước khi join',
    description: 'Kiểm tra xem có thể join video call không và ai đang trong call'
  })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ 
    status: HttpStatus.OK,
    schema: {
      example: {
        canJoin: true,
        appointmentStatus: 'CONFIRMED',
        meetingUrl: 'https://...',
        scheduledAt: '2024-01-10T10:00:00Z',
        minutesUntilStart: 30,
        isEarly: false,
        isLate: false,
        participantsInCall: ['doctor-uuid'],
      }
    }
  })
  async getVideoCallStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    const isPatient = appointment.patientId === user.patientId;
    const isDoctor = appointment.doctorId === user.doctorId;

    if (!isPatient && !isDoctor && !user.roles?.includes(RoleEnum.ADMIN)) {
      throw new ForbiddenException(
        'Bạn không có quyền xem thông tin cuộc hẹn này',
      );
    }

    if (appointment.appointmentType !== AppointmentTypeEnum.VIDEO) {
      throw new ForbiddenException('This is not a VIDEO appointment');
    }

    const now = new Date();
    const scheduledTime = new Date(appointment.scheduledAt);
    const minutesUntilStart = Math.round(
      (scheduledTime.getTime() - now.getTime()) / (1000 * 60)
    );

    const participantsInCall: string[] = [];


    const validStates = [
      AppointmentStatusEnum.CONFIRMED,
      AppointmentStatusEnum.CHECKED_IN,
      AppointmentStatusEnum.IN_PROGRESS,
    ];
    const canJoin = validStates.includes(appointment.status) &&
                    minutesUntilStart <= 60 && 
                    minutesUntilStart >= -30;

    return {
      canJoin,
      appointmentStatus: appointment.status,
      meetingUrl: appointment.meetingUrl,
      scheduledAt: appointment.scheduledAt,
      minutesUntilStart,
      isEarly: minutesUntilStart > 60,
      isLate: minutesUntilStart < -30,
      participantsInCall,
      message: canJoin 
        ? 'Bạn có thể join video call'
        : minutesUntilStart > 60
          ? `Chưa đến giờ join. Vui lòng quay lại sau ${minutesUntilStart - 60} phút`
          : minutesUntilStart < -30
            ? 'Cuộc gọi đã kết thúc'
            : 'Không thể join ở trạng thái hiện tại',
    };
  }

  @Post(':id/video/join')
  @ApiOperation({ summary: 'Lấy token để join video call' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không phải video appointment hoặc chưa tạo phòng',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async joinVideoCall(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const isDoctor = user.roles?.includes(RoleEnum.DOCTOR) ?? false;
    const userName = user.fullName || user.email || 'User';

    return this.appointmentService.generateMeetingToken(
      id,
      user.id,
      userName,
      isDoctor,
    );
  }

  @Post(':id/video/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rời khỏi video call' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK })
  async leaveVideoCall(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.appointmentService.leaveCall(user.id, id);
    return { message: 'Left call successfully' };
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

  // ============================================================================
  // CÁC ENDPOINT THÔNG TIN LÂM SÀNG
  // ============================================================================

  @Patch(':id/clinical')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Cập nhật thông tin lâm sàng' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể cập nhật',
  })
  async updateClinicalInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      chiefComplaint?: string;    // Lý do khám chính
      symptoms?: string[];         // Danh sách triệu chứng
      patientNotes?: string;       // Ghi chú của bệnh nhân
      doctorNotes?: string;        // Ghi chú của bác sĩ
    },
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

    return this.appointmentService.updateClinicalInfo(id, dto);
  }
}
