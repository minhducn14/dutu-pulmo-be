
import {
  Controller,
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
  BadRequestException,
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
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { CreateAppointmentDto } from '@/modules/appointment/dto/create-appointment.dto';
import { UpdateStatusDto } from '@/modules/appointment/dto/update-status.dto';
import { CancelAppointmentDto } from '@/modules/appointment/dto/cancel-appointment.dto';
import { RescheduleAppointmentDto } from '@/modules/appointment/dto/reschedule-appointment.dto';
import { CompleteExaminationDto } from '@/modules/appointment/dto/complete-examination.dto';
import { CheckInByNumberDto } from '@/modules/appointment/dto/check-in-by-number.dto';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { JoinVideoCallResponseDto } from '@/modules/appointment/dto/video-call-response.dto';
import { UpdateMedicalRecordDto } from '@/modules/medical/dto/update-medical-record.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { MedicalService } from '@/modules/medical/medical.service';
import { AppointmentMedicalAccessService } from '@/modules/appointment/services/appointment-medical-access.service';
import { CreateVitalSignDto } from '@/modules/medical/dto/create-vital-sign.dto';
import { CreatePrescriptionDto } from '@/modules/medical/dto/create-prescription.dto';
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

@ApiTags('Appointment Actions')
@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class AppointmentActionController {
  constructor(
    private readonly appointmentService: AppointmentService,
    private readonly medicalService: MedicalService,
    private readonly accessService: AppointmentMedicalAccessService,
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
    const isPatientOnly =
      user.roles?.includes(RoleEnum.PATIENT) &&
      !user.roles?.some((role) =>
        [RoleEnum.ADMIN, RoleEnum.DOCTOR, RoleEnum.RECEPTIONIST].includes(
          role as RoleEnum,
        ),
      );

    if (isPatientOnly) {
      if (!user.patientId) {
        throw new ForbiddenException('Không tìm thấy thông tin bệnh nhân');
      }

      if (dto.patientId && dto.patientId !== user.patientId) {
        throw new ForbiddenException('Bạn chỉ có thể đặt lịch cho chính mình');
      }

      dto.patientId = user.patientId;
    } else {
      if (!dto.patientId) {
        throw new BadRequestException('Vui lòng chọn bệnh nhân');
      }
    }

    const response = await this.appointmentService.create({
      ...dto,
      bookedByUserId: user.id,
    });
    return this.wrapAppointment(response);
  }

  @Post(':id/check-in')
  @Roles(RoleEnum.DOCTOR, RoleEnum.PATIENT, RoleEnum.ADMIN, RoleEnum.RECEPTIONIST)
  @ApiOperation({
    summary: 'Check-in bệnh nhân',
    description: `
      - IN_CLINIC: Lễ tân/bác sĩ check-in khi bệnh nhân đến (30 phút trước - 15 phút sau)
      - VIDEO: Bệnh nhân/bác sĩ check-in trước khi join call (1 giờ trước - 30 phút sau)
    `,
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
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (appointment.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      const canCheckIn =
        user.roles?.includes(RoleEnum.ADMIN) ||
        user.roles?.includes(RoleEnum.RECEPTIONIST) ||
        (user.roles?.includes(RoleEnum.DOCTOR) &&
          appointment.doctor.id === user.doctorId);

      if (!canCheckIn) {
        throw new ForbiddenException(
          'Chỉ lễ tân, y tá hoặc bác sĩ mới có thể check-in cho lịch hẹn tại phòng khám',
        );
      }
    } else if (appointment.appointmentType === AppointmentTypeEnum.VIDEO) {
      const isPatient = appointment.patient.id === user.patientId;
      const isDoctor = appointment.doctor.id === user.doctorId;
      const isAdmin = user.roles?.includes(RoleEnum.ADMIN);

      if (!isPatient && !isDoctor && !isAdmin) {
        throw new ForbiddenException(
          'Chỉ bệnh nhân hoặc bác sĩ của cuộc hẹn mới có thể check-in',
        );
      }
    }

    const response = await this.appointmentService.checkIn(id);
    return this.wrapAppointment(response);
  }

  @Post('check-in-by-number')
  @Roles(RoleEnum.ADMIN, RoleEnum.RECEPTIONIST, RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Check-in bằng mã lịch hẹn (QR code)',
    description: `
      Dùng cho lễ tân/bác sĩ quét QR code hoặc nhập mã lịch hẹn để check-in.
      Endpoint này chỉ hỗ trợ IN_CLINIC appointments.
    `,
  })
  @ApiResponse({ status: HttpStatus.OK, type: AppointmentResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy lịch hẹn với mã này',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không thể check-in (sai trạng thái, sai thời gian)',
  })
  async checkInByNumber(
    @Body() dto: CheckInByNumberDto,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const response = await this.appointmentService.checkInByNumber(
      dto.appointmentNumber,
    );
    return this.wrapAppointment(response);
  }

  @Post(':id/check-in/video')
  @Roles(RoleEnum.PATIENT, RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Check-in cho cuộc hẹn VIDEO (bệnh nhân hoặc bác sĩ)',
    description:
      'Cho phép check-in trước giờ hẹn 1 tiếng để chuẩn bị join video call',
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
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    const isPatient = appointment.patient.id === user.patientId;
    const isDoctor = appointment.doctor.id === user.doctorId;

    if (!isPatient && !isDoctor && !user.roles?.includes(RoleEnum.ADMIN)) {
      throw new ForbiddenException('Bạn không có quyền check-in cuộc hẹn này');
    }

    const response = await this.appointmentService.checkInVideo(id);
    return this.wrapAppointment(response);
  }

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
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (appointment.doctor.id !== user.doctorId) {
      throw new ForbiddenException('Bạn chỉ có thể khám bệnh nhân của mình');
    }

    const response = await this.appointmentService.startExamination(id);
    return this.wrapAppointment(response);
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
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.appointmentService.findById(id);
    const appointment = result.data!;

    if (appointment.doctor.id !== user.doctorId) {
      throw new ForbiddenException(
        'Bạn chỉ có thể hoàn thành khám bệnh nhân của mình',
      );
    }

    const response = await this.appointmentService.completeExamination(id, dto);
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

  @Post(':id/video/join')
  @ApiOperation({ summary: 'Lấy token để join video call' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, type: JoinVideoCallResponseDto })
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
      user.userId,
      userName,
      isDoctor,
    );
  }

  @Post(':id/video/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rời khỏi video call' })
  @ApiParam({ name: 'id', description: 'Appointment ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK })
  leaveVideoCall(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ) {
    this.appointmentService.leaveCall(user.userId, id);
    return { message: 'Left call successfully' };
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
      chiefComplaint?: string;
      symptoms?: string[];
      patientNotes?: string;
      doctorNotes?: string;
    },
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
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

    const response = await this.appointmentService.updateClinicalInfo(id, dto);
    return this.wrapAppointment(response);
  }

  @Put(':id/medical-record')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({
    summary: 'Cập nhật hồ sơ bệnh án của lịch hẹn (Doctor/Admin)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật hồ sơ bệnh án thành công',
    type: MedicalRecordResponseDto,
  })
  async updateMedicalRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicalRecordDto,
    @CurrentUser() user: JwtUser,
  ) {
    const appt = await this.appointmentService.findOne(id);
    if (!appt) throw new NotFoundException('Không tìm thấy lịch hẹn');

    this.accessService.validateMedicalStatus(appt.status, 'EDIT');
    this.accessService.checkEditAccess(user, appt);

    const response = await this.medicalService.updateEncounterByAppointment(
      id,
      dto,
    );
    const record = response.data;
    if (!record) {
      throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      mapMedicalRecordToDto(record),
    );
  }

  @Post(':id/vital-signs')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({
    summary: 'Ghi nhận chỉ số sinh tồn cho lịch hẹn (Doctor/Admin)',
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Thêm chỉ số sinh tồn thành công',
    type: VitalSignResponseDto,
  })
  async addVitalSign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVitalSignDto,
    @CurrentUser() user: JwtUser,
  ) {
    const appt = await this.appointmentService.findOne(id);
    if (!appt) throw new NotFoundException('Không tìm thấy lịch hẹn');

    this.accessService.validateMedicalStatus(appt.status, 'EDIT');
    this.accessService.checkEditAccess(user, appt);

    const encounterResponse =
      await this.medicalService.getEncounterByAppointment(id);
    const encounter = encounterResponse.data;
    if (!encounter) throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');

    const response = await this.medicalService.addVitalSignToEncounter(
      encounter.id,
      appt.patientId,
      dto,
    );
    const vitalSign = response.data;
    if (!vitalSign) {
      throw new NotFoundException('Không tìm thấy chỉ số sinh tồn');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      mapVitalSignToDto(vitalSign),
    );
  }

  @Post(':id/prescriptions')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Kê đơn thuốc cho lịch hẹn (Doctor only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo đơn thuốc thành công',
    type: PrescriptionResponseDto,
  })
  async createPrescription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: JwtUser,
  ) {
    const appt = await this.appointmentService.findOne(id);
    if (!appt) throw new NotFoundException('Không tìm thấy lịch hẹn');

    this.accessService.validateMedicalStatus(appt.status, 'EDIT');

    const isDoctor = user.doctorId === appt.doctorId;
    if (!isDoctor)
      throw new ForbiddenException('Chỉ bác sĩ phụ trách mới có thể kê đơn');

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Đơn thuốc phải có ít nhất 1 loại thuốc');
    }

    const encounterResponse =
      await this.medicalService.getEncounterByAppointment(id);
    const encounter = encounterResponse.data;
    if (!encounter) throw new NotFoundException('Không tìm thấy hồ sơ bệnh án');

    const response = await this.medicalService.createPrescriptionForEncounter(
      encounter.id,
      appt.patientId,
      user.doctorId || appt.doctorId,
      id,
      dto,
    );
    const prescription = response.data;
    if (!prescription) {
      throw new NotFoundException('Không tìm thấy đơn thuốc');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      mapPrescriptionToDto(prescription),
    );
  }

  @Post(':id/prescriptions/:prescriptionId/cancel')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Hủy đơn thuốc (Doctor/Admin)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hủy đơn thuốc thành công',
  })
  async cancelPrescription(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @CurrentUser() user: JwtUser,
  ) {
    const appt = await this.appointmentService.findOne(id);
    if (!appt) throw new NotFoundException('Không tìm thấy lịch hẹn');

    this.accessService.validateMedicalStatus(appt.status, 'EDIT');

    const response = await this.medicalService.cancelPrescription(
      prescriptionId,
      user,
    );
    const prescription = response.data;
    if (!prescription) {
      throw new NotFoundException('Không tìm thấy đơn thuốc');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      mapPrescriptionToDto(prescription),
    );
  }

  @Put(':id/prescriptions/:prescriptionId/cancel')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  async cancelPrescriptionPut(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.cancelPrescription(id, prescriptionId, user);
  }

  @Put(':id/prescriptions/:prescriptionId')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Cập nhật đơn thuốc (Doctor only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật đơn thuốc thành công',
    type: PrescriptionResponseDto,
  })
  async updatePrescription(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('prescriptionId', ParseUUIDPipe) prescriptionId: string,
    @Body() dto: CreatePrescriptionDto,
    @CurrentUser() user: JwtUser,
  ) {
    const appt = await this.appointmentService.findOne(id);
    if (!appt) throw new NotFoundException('Không tìm thấy lịch hẹn');

    this.accessService.validateMedicalStatus(appt.status, 'EDIT');

    const response = await this.medicalService.updatePrescription(
      prescriptionId,
      dto,
      user,
    );
    const prescription = response.data;
    if (!prescription) {
      throw new NotFoundException('Không tìm thấy đơn thuốc');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      mapPrescriptionToDto(prescription),
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
