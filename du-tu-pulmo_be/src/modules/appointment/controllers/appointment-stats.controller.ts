
import {
  Controller,
  Get,
  Param,
  HttpStatus,
  UseGuards,
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
import { AppointmentService } from '@/modules/appointment/services/appointment.service';
import { DashboardStatsService } from '@/modules/appointment/services/dashboard-stats.service';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import {
  AppointmentResponseDto,
  AppointmentStatisticsDto,
  DoctorQueueDto,
} from '@/modules/appointment/dto/appointment-response.dto';
import {
  UserCallStatusResponseDto,
  VideoCallStatusResponseDto,
} from '@/modules/appointment/dto/video-call-response.dto';
import {
  DashboardQueryDto,
  DashboardStatsDto,
} from '@/modules/appointment/dto/dashboard-stats.dto';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Appointment Statistics')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AppointmentStatsController {
  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly dashboardStatsService: DashboardStatsService,
  ) {}

  @Get('doctor/:doctorId/queue')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN, RoleEnum.RECEPTIONIST)
  @ApiOperation({ summary: 'Lấy hàng đợi khám của bác sĩ' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: DoctorQueueDto })
  async getDoctorQueue(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<DoctorQueueDto>> {
    if (
      !user.roles?.includes(RoleEnum.ADMIN) &&
      !user.roles?.includes(RoleEnum.RECEPTIONIST) &&
      user.roles?.includes(RoleEnum.DOCTOR)
    ) {
      if (user.doctorId !== doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể xem hàng đợi của mình');
      }
    }

    const response = await this.appointmentService.getDoctorQueue(doctorId);
    return this.wrapGeneric(response);
  }

  @Get('my/doctor/queue')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy hàng đợi khám của bác sĩ hiện tại' })
  @ApiResponse({ status: HttpStatus.OK, type: DoctorQueueDto })
  async getMyQueue(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<DoctorQueueDto>> {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    const response = await this.appointmentService.getDoctorQueue(
      user.doctorId,
    );
    return this.wrapGeneric(response);
  }

  @Get('my/doctor/checked-in')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Lấy danh sách bệnh nhân đã check-in đang chờ khám',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  async getCheckedInPatients(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    const response = await this.appointmentService.findCheckedInByDoctor(
      user.doctorId,
    );
    return this.wrapAppointmentList(response);
  }

  @Get('my/doctor/statistics')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy thống kê lịch hẹn của bác sĩ' })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Ngày kết thúc (YYYY-MM-DD)',
  })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentStatisticsDto })
  async getMyStatistics(
    @CurrentUser() user: JwtUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<ResponseCommon<AppointmentStatisticsDto>> {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }

    const response = await this.appointmentService.getDoctorStatistics(
      user.doctorId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return this.wrapGeneric(response);
  }

  @Get('my/doctor/dashboard')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Lấy báo cáo tổng quan dashboard của bác sĩ',
    description: 'Trả về thống kê doanh thu, lượt khám, bệnh nhân mới/cũ theo kỳ',
  })
  @ApiResponse({ status: HttpStatus.OK, type: DashboardStatsDto })
  async getMyDashboard(
    @CurrentUser() user: JwtUser,
    @Query() query: DashboardQueryDto,
  ): Promise<ResponseCommon<DashboardStatsDto>> {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    return this.dashboardStatsService.getStats(user.doctorId, query.period);
  }

  @Get('doctor/:doctorId/dashboard')
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({
    summary: 'Lấy báo cáo tổng quan dashboard của bác sĩ (Admin)',
  })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: DashboardStatsDto })
  async getDoctorDashboard(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() query: DashboardQueryDto,
  ): Promise<ResponseCommon<DashboardStatsDto>> {
    return this.dashboardStatsService.getStats(doctorId, query.period);
  }

  @Get('my/patient/statistics')
  @Roles(RoleEnum.PATIENT)
  @ApiOperation({ summary: 'Lấy thống kê lịch hẹn của bệnh nhân' })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentStatisticsDto })
  async getMyPatientStats(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AppointmentStatisticsDto>> {
    if (!user.patientId) {
      throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
    }
    const response = await this.appointmentService.getPatientStatistics(
      user.patientId,
    );
    return this.wrapGeneric(response);
  }

  @Get('doctor/:doctorId/calendar')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Lấy lịch khám theo calendar view' })
  @ApiParam({ name: 'doctorId', description: 'Doctor ID (UUID)' })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'Ngày kết thúc (YYYY-MM-DD)',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  async getCalendar(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    if (
      !user.roles?.includes(RoleEnum.ADMIN) &&
      user.roles?.includes(RoleEnum.DOCTOR)
    ) {
      if (user.doctorId !== doctorId) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch của mình');
      }
    }

    const response = await this.appointmentService.getCalendar(
      doctorId,
      new Date(startDate),
      new Date(endDate),
    );
    return this.wrapAppointmentList(response);
  }

  @Get('my/doctor/calendar')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Lấy lịch khám của bác sĩ hiện tại theo calendar view',
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: 'Ngày kết thúc (YYYY-MM-DD)',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [AppointmentResponseDto] })
  async getMyCalendar(
    @CurrentUser() user: JwtUser,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }

    const response = await this.appointmentService.getCalendar(
      user.doctorId,
      new Date(startDate),
      new Date(endDate),
    );
    return this.wrapAppointmentList(response);
  }

  @Get('me/call-status')
  @ApiOperation({ summary: 'Kiểm tra trạng thái cuộc gọi hiện tại của user' })
  @ApiResponse({ status: HttpStatus.OK, type: UserCallStatusResponseDto })
  getMyCallStatus(@CurrentUser() user: JwtUser) {
    return this.appointmentService.getUserCallStatus(user.id);
  }

  @Get(':id/video/status')
  @ApiOperation({
    summary: 'Kiểm tra trạng thái video call trước khi join',
    description:
      'Kiểm tra xem có thể join video call không và ai đang trong call',
  })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: VideoCallStatusResponseDto,
  })
  async getVideoCallStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    const isPatient = appointment.patient.id === user.patientId;
    const isDoctor = appointment.doctor.id === user.doctorId;

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
      (scheduledTime.getTime() - now.getTime()) / (1000 * 60),
    );

    const participantsInCall: string[] = [];

    const validStates = [
      AppointmentStatusEnum.CONFIRMED,
      AppointmentStatusEnum.CHECKED_IN,
      AppointmentStatusEnum.IN_PROGRESS,
    ];
    const canJoin =
      validStates.includes(appointment.status) &&
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

  private wrapGeneric<T>(response: ResponseCommon<T>): ResponseCommon<T> {
    return new ResponseCommon(
      response.code,
      response.message,
      response.data as T,
    );
  }

  private wrapAppointmentList(
    response: ResponseCommon<AppointmentResponseDto[]>,
  ): ResponseCommon<AppointmentResponseDto[]> {
    return new ResponseCommon(
      response.code,
      response.message,
      AppointmentResponseDto.mapList(response.data),
    );
  }
}
