import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  Put,
  UseInterceptors,
  ClassSerializerInterceptor,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MedicalService } from '@/modules/medical/medical.service';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { VitalSign } from '@/modules/medical/entities/vital-sign.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import {
  MedicalRecordResponseDto,
  VitalSignResponseDto,
  PrescriptionResponseDto,
  PrescriptionItemResponseDto,
} from '@/modules/medical/dto/medical-response.dto';
import { MedicalRecordDetailResponseDto } from '@/modules/medical/dto/get-medical-record-detail.dto';
import { MedicalRecordExaminationDto } from '@/modules/medical/dto/medical-record-examination.dto';
import { UpdateMedicalRecordDto } from '@/modules/medical/dto/update-medical-record.dto';
import { SignMedicalRecordDto } from '@/modules/medical/dto/sign-medical-record.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { AppointmentService } from '@/modules/appointment/services/appointment.service';
import { ResponseCommon } from '@/common/dto/response.dto';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { DoctorResponseDto } from '@/modules/doctor/dto/doctor-response.dto';
import { PatientResponseDto } from '@/modules/patient/dto/patient-response.dto';
import { MedicalRecordSummaryDto } from '@/modules/medical/dto/medical-record-summary.dto';

@ApiTags('Medical Records')
@Controller('medical')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth('JWT-auth')
export class MedicalController {
  constructor(
    private readonly medicalService: MedicalService,
    private readonly appointmentService: AppointmentService,
  ) {}

  private async validatePatientAccess(
    user: JwtUser,
    patientId: string,
  ): Promise<void> {
    if (!user.roles) {
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
    }

    if (user.roles.includes(RoleEnum.ADMIN)) return;

    if (user.roles.includes(RoleEnum.PATIENT)) {
      if (user.patientId !== patientId) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
      }
      return;
    }

    if (user.roles.includes(RoleEnum.DOCTOR)) {
      if (!user.doctorId)
        throw new ForbiddenException(ERROR_MESSAGES.DOCTOR_ID_MISSING);
      const hasAccess = await this.appointmentService.hasAnyAppointment(
        user.doctorId,
        patientId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
      }
      return;
    }

    throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
  }

  // ==================== Mappers ====================

  private toRecordDto(record: MedicalRecord): MedicalRecordResponseDto {
    return {
      id: record.id,
      recordNumber: record.recordNumber,
      patientId: record.patientId,
      patient: record.patient
        ? PatientResponseDto.fromEntity(record.patient)
        : (null as unknown as PatientResponseDto),
      doctorId: record.doctorId || undefined,
      doctor: record.doctor
        ? DoctorResponseDto.fromEntity(record.doctor)
        : (null as unknown as DoctorResponseDto),
      appointmentId: record.appointmentId,
      appointment: record.appointment
        ? AppointmentResponseDto.fromEntity(record.appointment)
        : undefined,
      chiefComplaint: record.chiefComplaint || undefined,
      presentIllnessHistory: record.presentIllness || undefined,
      pastMedicalHistory: record.medicalHistory || undefined,
      physicalExamNotes: record.physicalExamNotes || undefined,
      assessment: record.assessment || undefined,
      diagnosis: record.diagnosis || undefined,
      treatmentPlan: record.treatmentPlan || undefined,
      status: record.status || 'UNKNOWN',
      previousRecordId: record.previousRecordId || undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private toPrescriptionDto(
    prescription: Prescription,
  ): PrescriptionResponseDto {
    const diagnosisName = this.getDiagnosisName(prescription);
    const items: PrescriptionItemResponseDto[] =
      prescription.items?.map((item) => ({
        id: item.id,
        medicineId: item.medicineId || undefined,
        medicineName: item.medicineName,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.durationDays ? `${item.durationDays} ngày` : '0 ngày',
        quantity: item.quantity,
        instructions: item.instructions || undefined,
        unit: item.unit,
      })) || [];

    return {
      id: prescription.id,
      prescriptionNumber: prescription.prescriptionNumber,
      patientId: prescription.patientId,
      patient: prescription.patient
        ? PatientResponseDto.fromEntity(prescription.patient)
        : (null as unknown as PatientResponseDto),
      doctorId: prescription.doctorId || undefined,
      doctor: prescription.doctor
        ? DoctorResponseDto.fromEntity(prescription.doctor)
        : undefined,
      medicalRecordId: prescription.medicalRecordId || undefined,
      medicalRecord: prescription.medicalRecord
        ? this.toRecordDto(prescription.medicalRecord)
        : undefined,
      appointmentId: prescription.appointmentId || undefined,
      appointment: prescription.appointment
        ? AppointmentResponseDto.fromEntity(prescription.appointment)
        : undefined,
      diagnosis: diagnosisName,
      notes: prescription.notes || undefined,
      status: prescription.status || undefined,
      items: items,
      createdAt: prescription.createdAt,
      pdfUrl: prescription.pdfUrl || undefined,
    };
  }

  private toVitalSignDto(vs: VitalSign): VitalSignResponseDto {
    return {
      id: vs.id,
      patientId: vs.patientId,
      medicalRecordId: vs.medicalRecordId || undefined,
      temperature: vs.temperature ? Number(vs.temperature) : undefined,
      bloodPressure: vs.bloodPressure || undefined,
      heartRate: vs.heartRate ? Number(vs.heartRate) : undefined,
      respiratoryRate: vs.respiratoryRate
        ? Number(vs.respiratoryRate)
        : undefined,
      spo2: vs.spo2 ? Number(vs.spo2) : undefined,
      height: vs.height ? Number(vs.height) : undefined,
      weight: vs.weight ? Number(vs.weight) : undefined,
      bmi: vs.bmi ? Number(vs.bmi) : undefined,
      notes: undefined,
      createdAt: vs.createdAt,
    };
  }

  private getDiagnosisName(prescription: Prescription): string | undefined {
    return prescription.medicalRecord?.diagnosis || undefined;
  }

  // ==================== Medical Records ====================

  @Get('records/my')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Lấy hồ sơ bệnh án gần đây của bác sĩ (Recent History)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách hồ sơ bệnh án gần đây',
    type: [MedicalRecordResponseDto],
  })
  async getMyRecords(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordResponseDto[]>> {
    if (!user.doctorId)
      throw new ForbiddenException(ERROR_MESSAGES.DOCTOR_ID_MISSING);

    const result = await this.medicalService.findRecordsByDoctor(user.doctorId);
    const dtos = (result.data || []).map((r) => this.toRecordDto(r));
    return new ResponseCommon(result.code, result.message, dtos);
  }

  @Get('records/patient/:patientId')
  @ApiOperation({
    summary: 'Lấy hồ sơ bệnh án của bệnh nhân (Reference/History View)',
  })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách hồ sơ bệnh án',
    type: [MedicalRecordResponseDto],
  })
  async findRecordsByPatient(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordResponseDto[]>> {
    await this.validatePatientAccess(user, patientId);
    const doctorId = user.roles?.includes(RoleEnum.DOCTOR)
      ? user.doctorId
      : undefined;
    const result = await this.medicalService.findRecordsByPatient(
      patientId,
      doctorId,
    );

    // Safe access
    const dtos = (result.data || []).map((r) => this.toRecordDto(r));
    return new ResponseCommon(result.code, result.message, dtos);
  }

  // ==================== Medical Record Detail ====================

  @Get('records/:id/detail')
  @ApiOperation({ summary: 'Lấy chi tiết bệnh án (Detail Page - Read-only)' })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chi tiết bệnh án',
    type: MedicalRecordDetailResponseDto,
  })
  async getMedicalRecordDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordDetailResponseDto>> {
    return this.medicalService.getMedicalRecordDetail(id, user);
  }

  @Put('records/:id')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Cập nhật hồ sơ bệnh án' })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật thành công',
  })
  async updateMedicalRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicalRecordDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordDetailResponseDto>> {
    const recordResponse = await this.medicalService.getMedicalRecordDetail(
      id,
      user,
    );
    const record = recordResponse.data;

    if (!record) {
      throw new ForbiddenException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    if (
      user.roles?.includes(RoleEnum.DOCTOR) &&
      !user.roles.includes(RoleEnum.ADMIN)
    ) {
      if (record.doctor.id !== user.doctorId) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
      }
    }

    await this.medicalService.updateMedicalRecord(id, dto, user);

    return this.medicalService.getMedicalRecordDetail(id, user);
  }

  @Post('records/:id/sign')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Ký số bệnh án' })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ký số thành công',
  })
  async signMedicalRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SignMedicalRecordDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordDetailResponseDto>> {
    return this.medicalService.signMedicalRecord(id, dto, user);
  }

  @Post('records/:id/complete')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({
    summary: 'Hoàn tất bệnh án (không thể chỉnh sửa sau khi complete)',
  })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Hoàn tất thành công' })
  async completeMedicalRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordResponseDto>> {
    const result = await this.medicalService.completeMedicalRecord(id, user);
    return new ResponseCommon(
      result.code,
      result.message,
      this.toRecordDto(result.data as MedicalRecord),
    );
  }

  @Post('records/:id/reopen')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({
    summary:
      'Mở lại bệnh án đã COMPLETED. DOCTOR: chỉ trong 48h và chính chủ. ADMIN: không giới hạn.',
  })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Mở lại thành công' })
  async reopenMedicalRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordResponseDto>> {
    const result = await this.medicalService.reopenMedicalRecord(id, user);
    return new ResponseCommon(
      result.code,
      result.message,
      this.toRecordDto(result.data as MedicalRecord),
    );
  }

  // ==================== Specialized Views ====================

  @Get('records/:id/examination')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy thông tin bệnh án để khám bệnh (Doctor Only)' })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin khám bệnh',
    type: MedicalRecordExaminationDto,
  })
  async getMedicalRecordForExamination(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordExaminationDto>> {
    return this.medicalService.getMedicalRecordForExamination(id, user);
  }

  @Get('records/:id/summary')
  @Roles(RoleEnum.DOCTOR, RoleEnum.PATIENT, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Lấy thông tin tổng kết bệnh án' })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin tổng kết',
    type: MedicalRecordSummaryDto,
  })
  async getMedicalRecordForSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordSummaryDto>> {
    return this.medicalService.getMedicalRecordForSummary(id, user);
  }

  // ==================== Vital Signs ====================

  @Get('vital-signs/patient/:patientId')
  @ApiOperation({ summary: 'Lấy chỉ số sinh tồn của bệnh nhân' })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách chỉ số sinh tồn',
    type: [VitalSignResponseDto],
  })
  async findVitalSigns(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<VitalSignResponseDto[]>> {
    await this.validatePatientAccess(user, patientId);

    // Strict Mode for Doctors: Only return their own records
    const doctorId = user.roles?.includes(RoleEnum.DOCTOR)
      ? user.doctorId
      : undefined;

    const result = await this.medicalService.findVitalSignsByPatient(
      patientId,
      doctorId,
    );
    const dtos = (result.data || []).map((vs) => this.toVitalSignDto(vs));
    return new ResponseCommon(result.code, result.message, dtos);
  }

  // ==================== Prescriptions ====================

  @Get('prescriptions/my')
  @Roles(RoleEnum.DOCTOR)
  @ApiOperation({ summary: 'Lấy danh sách đơn thuốc gần đây của bác sĩ' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách đơn thuốc gần đây',
    type: [PrescriptionResponseDto],
  })
  async getMyPrescriptions(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PrescriptionResponseDto[]>> {
    if (!user.doctorId)
      throw new ForbiddenException(ERROR_MESSAGES.DOCTOR_ID_MISSING);

    const result = await this.medicalService.findPrescriptionsByDoctor(
      user.doctorId,
    );
    const dtos = (result.data || []).map((p) => this.toPrescriptionDto(p));
    return new ResponseCommon(result.code, result.message, dtos);
  }

  @Get('prescriptions/:id')
  @ApiOperation({ summary: 'Lấy chi tiết đơn thuốc' })
  @ApiParam({ name: 'id', description: 'Prescription ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Chi tiết đơn thuốc',
    type: PrescriptionResponseDto,
  })
  async getPrescriptionDetail(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PrescriptionResponseDto>> {
    const result = await this.medicalService.getPrescriptionDetail(id, user);
    const dto = this.toPrescriptionDto(result.data!);
    return new ResponseCommon(result.code, result.message, dto);
  }

  @Get('prescriptions/patient/:patientId')
  @ApiOperation({ summary: 'Lấy danh sách đơn thuốc của bệnh nhân' })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách đơn thuốc',
    type: [PrescriptionResponseDto],
  })
  async findPrescriptions(
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PrescriptionResponseDto[]>> {
    await this.validatePatientAccess(user, patientId);

    // Strict Mode for Doctors: Only return their own prescriptions
    const doctorId = user.roles?.includes(RoleEnum.DOCTOR)
      ? user.doctorId
      : undefined;

    // Strict Mode for Patients: Only return their own prescriptions
    const result = await this.medicalService.findPrescriptionsByPatient(
      patientId,
      doctorId,
    );

    const dtos = (result.data || []).map((p) => this.toPrescriptionDto(p));

    return new ResponseCommon(result.code, result.message, dtos);
  }

  // ==================== PDF Generation ====================

  @Post('records/:id/pdf')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Tạo PDF bệnh án và lưu lên Cloudinary' })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo PDF thành công, trả về URL',
    schema: { example: { pdfUrl: 'https://res.cloudinary.com/...' } },
  })
  async generateMedicalRecordPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<{ pdfUrl: string }>> {
    const pdfUrl = await this.medicalService.generateMedicalRecordPdf(id, user);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'Tạo PDF bệnh án thành công',
      { pdfUrl },
    );
  }

  @Get('records/:id/pdf')
  @Roles(RoleEnum.DOCTOR, RoleEnum.PATIENT, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Lấy URL PDF bệnh án đã lưu' })
  @ApiParam({ name: 'id', description: 'Medical Record ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'URL PDF bệnh án',
    schema: { example: { pdfUrl: 'https://res.cloudinary.com/...' } },
  })
  async getMedicalRecordPdfUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<{ pdfUrl: string | null }>> {
    const result = await this.medicalService.getMedicalRecordDetail(id, user);
    if (!result.data)
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    return new ResponseCommon(HttpStatus.OK, 'Thành công', {
      pdfUrl: result.data.pdfUrl ?? null,
    });
  }

  @Post('prescriptions/:id/pdf')
  @Roles(RoleEnum.DOCTOR, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Tạo PDF đơn thuốc và lưu lên Cloudinary' })
  @ApiParam({ name: 'id', description: 'Prescription ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Tạo PDF thành công, trả về URL',
    schema: { example: { pdfUrl: 'https://res.cloudinary.com/...' } },
  })
  async generatePrescriptionPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<{ pdfUrl: string }>> {
    const pdfUrl = await this.medicalService.generatePrescriptionPdf(id, user);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'Tạo PDF đơn thuốc thành công',
      { pdfUrl },
    );
  }

  @Get('prescriptions/:id/pdf')
  @Roles(RoleEnum.DOCTOR, RoleEnum.PATIENT, RoleEnum.ADMIN)
  @ApiOperation({ summary: 'Lấy URL PDF đơn thuốc đã lưu' })
  @ApiParam({ name: 'id', description: 'Prescription ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'URL PDF đơn thuốc',
    schema: { example: { pdfUrl: 'https://res.cloudinary.com/...' } },
  })
  async getPrescriptionPdfUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<{ pdfUrl: string | null }>> {
    const result = await this.medicalService.getPrescriptionDetail(id, user);
    if (!result.data)
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    return new ResponseCommon(HttpStatus.OK, 'Thành công', {
      pdfUrl: result.data.pdfUrl ?? null,
    });
  }
}
