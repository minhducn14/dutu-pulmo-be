
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
import { MedicalService } from '@/modules/medical/medical.service';
import {
  MedicalRecordResponseDto,
  VitalSignResponseDto,
  PrescriptionResponseDto,
} from '@/modules/medical/dto/medical-response.dto';
import {
  mapMedicalRecordToDto,
  mapPrescriptionToDto,
  mapVitalSignToDto,
} from '@/modules/appointment/mappers/appointment-medical.mapper';
import { AppointmentMedicalAccessService } from '@/modules/appointment/services/appointment-medical-access.service';

@ApiTags('Appointment Read')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AppointmentReadController {
  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly medicalService: MedicalService,
    private readonly accessService: AppointmentMedicalAccessService,
  ) {}

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
      !user.roles?.includes(RoleEnum.DOCTOR) &&
      !user.roles?.includes(RoleEnum.RECEPTIONIST)
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

  @Get(':id/medical-record')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN, RoleEnum.PATIENT)
  @ApiOperation({ summary: 'Lấy hồ sơ bệnh án của lịch hẹn' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: MedicalRecordResponseDto })
  async getMedicalRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    // Permission check
    const appt = await this.appointmentService.findOne(id);
    if (!appt) throw new NotFoundException('Appointment not found');

    this.accessService.checkViewAccess(user, appt);

    try {
      const response =
        await this.medicalService.getEncounterByAppointment(id);
      const record = response.data;
      if (!record) {
        throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');
      }
      return new ResponseCommon(
        response.code,
        response.message,
        mapMedicalRecordToDto(record),
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        if (!this.accessService.isViewStatus(appt.status)) {
          return new ResponseCommon(
            200,
            'Hồ sơ bệnh án chưa được tạo (lịch hẹn chưa bắt đầu khám)',
            null,
          );
        }
      }
      throw error;
    }
  }

  @Get(':id/vital-signs')
  @ApiOperation({ summary: 'Lấy danh sách chỉ số sinh tồn của lịch hẹn' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách chỉ số sinh tồn thành công',
    type: [VitalSignResponseDto],
  })
  async getVitalSigns(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const appt = await this.appointmentService.findOne(id);
    if (!appt) throw new NotFoundException('Không tìm thấy lịch hẹn');

    this.accessService.checkViewAccess(user, appt);

    try {
      const response =
        await this.medicalService.getEncounterByAppointment(id);
      const record = response.data;
      const vitalSigns = record?.vitalSigns ?? [];
      const dtos = vitalSigns.map((vs) => mapVitalSignToDto(vs));
      return new ResponseCommon(200, 'SUCCESS', dtos);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return new ResponseCommon(200, 'Chưa có chỉ số sinh tồn', []);
      }
      throw error;
    }
  }

  @Get(':id/prescriptions')
  @ApiOperation({ summary: 'Lấy danh sách đơn thuốc của lịch hẹn' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lấy danh sách đơn thuốc thành công',
    type: [PrescriptionResponseDto],
  })
  async getPrescriptions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    const appt = await this.appointmentService.findOne(id);
    if (!appt) throw new NotFoundException('Không tìm thấy lịch hẹn');

    this.accessService.checkViewAccess(user, appt);

    try {
      const response =
        await this.medicalService.getEncounterByAppointment(id);
      const record = response.data;
      const prescriptions = record?.prescriptions ?? [];
      const dtos = prescriptions.map((p) => mapPrescriptionToDto(p));
      return new ResponseCommon(200, 'SUCCESS', dtos);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return new ResponseCommon(200, 'Chưa có đơn thuốc', []);
      }
      throw error;
    }
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
