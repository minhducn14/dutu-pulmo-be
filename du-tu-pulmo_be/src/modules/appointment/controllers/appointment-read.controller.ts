import {
  Controller,
  Get,
  Param,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
  Query,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AppointmentService } from '@/modules/appointment/services/appointment.service';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import {
  AppointmentResponseDto,
  PaginatedAppointmentResponseDto,
} from '@/modules/appointment/dto/appointment-response.dto';

import {
  AppointmentQueryDto,
  PatientAppointmentQueryDto,
} from '@/modules/appointment/dto/appointment-query.dto';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Appointment Read')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AppointmentReadController {
  constructor(private readonly appointmentService: AppointmentService) {
    
  }

  @Get()
  @Roles(RoleEnum.ADMIN, RoleEnum.RECEPTIONIST)
  @ApiOperation({
    summary: 'Lấy tất cả lịch hẹn (Admin)',
    description: 'Hỗ trợ phân trang và lọc theo status, type, date range',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  async findAll(
    @Query() query: AppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    const response = await this.appointmentService.findAll(query);
    return this.wrapPaginated(response);
  }

  @Get('my/patient')
  @Roles(RoleEnum.PATIENT)
  @ApiOperation({
    summary: 'Lấy lịch hẹn của bệnh nhân hiện tại',
    description: 'Hỗ trợ phân trang và lọc theo status',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  async findMyAppointmentsAsPatient(
    @CurrentUser() user: JwtUser,
    @Query() query: PatientAppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    if (!user.patientId) {
      throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
    }
    const response = await this.appointmentService.findByPatient(
      user.patientId,
      query,
    );
    return this.wrapPaginated(response);
  }

  @Get('my/doctor')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Lấy lịch hẹn của bác sĩ hiện tại',
    description: 'Hỗ trợ phân trang và lọc theo status',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedAppointmentResponseDto })
  async findMyAppointmentsAsDoctor(
    @CurrentUser() user: JwtUser,
    @Query() query: PatientAppointmentQueryDto,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    if (!user.doctorId) {
      throw new ForbiddenException('Không tìm thấy thông tin bác sĩ');
    }
    const response = await this.appointmentService.findByDoctor(
      user.doctorId,
      query,
    );
    return this.wrapPaginated(response);
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
  async findByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Query() query: PatientAppointmentQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    if (
      !user.roles?.includes(RoleEnum.ADMIN) &&
      !user.roles?.includes(RoleEnum.DOCTOR)
    ) {
      if (user.patientId !== patientId) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
      }
    }
    const response = await this.appointmentService.findByPatient(
      patientId,
      query,
    );
    return this.wrapPaginated(response);
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
  async findByDoctor(
    @Param('doctorId', ParseUUIDPipe) doctorId: string,
    @Query() query: PatientAppointmentQueryDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.DOCTOR)) {
        if (user.doctorId !== doctorId) {
          throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
        }
      } else {
        throw new ForbiddenException('Không có quyền truy cập');
      }
    }
    const response = await this.appointmentService.findByDoctor(
      doctorId,
      query,
    );
    return this.wrapPaginated(response);
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
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (
        user.roles?.includes(RoleEnum.PATIENT) &&
        appointment.patient.id !== user.patientId
      ) {
        throw new ForbiddenException('Bạn chỉ có thể xem lịch hẹn của mình');
      }
      if (
        user.roles?.includes(RoleEnum.DOCTOR) &&
        appointment.doctor.id !== user.doctorId
      ) {
        throw new ForbiddenException(
          'Bạn chỉ có thể xem lịch hẹn của bệnh nhân bạn khám',
        );
      }
    }

    return this.wrapAppointment(result);
  }

  private wrapPaginated(
    response: ResponseCommon<PaginatedAppointmentResponseDto>,
  ): ResponseCommon<PaginatedAppointmentResponseDto> {
    return new ResponseCommon(
      response.code,
      response.message,
      PaginatedAppointmentResponseDto.fromResult(response.data),
    );
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
