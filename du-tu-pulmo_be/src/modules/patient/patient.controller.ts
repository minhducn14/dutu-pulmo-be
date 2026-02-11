import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PatientService } from '@/modules/patient/patient.service';
import { PatientQueryDto, UpdatePatientDto } from '@/modules/patient/dto/patient.dto';
import {
  PatientResponseDto,
  PaginatedPatientResponseDto,
  PatientProfileResponseDto,
} from '@/modules/patient/dto/patient-response.dto';
import { PATIENT_ERRORS } from '@/common/constants/error-messages.constant';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import {
  MedicalRecordResponseDto,
  VitalSignResponseDto,
  PrescriptionResponseDto,
  PrescriptionItemResponseDto,
} from '@/modules/medical/dto/medical-response.dto';
import {
  PaginatedAppointmentResponseDto,
  AppointmentResponseDto,
} from '@/modules/appointment/dto/appointment-response.dto';
import { DoctorResponseDto } from '@/modules/doctor/dto/doctor-response.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import { VitalSign } from '@/modules/medical/entities/vital-sign.entity';

@ApiTags('Patients')
@Controller('patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // ==================== Mappers ====================

  private toPatientDto(patient: Patient): PatientResponseDto {
    return PatientResponseDto.fromEntity(patient);
  }

  private toRecordDto(record: MedicalRecord): MedicalRecordResponseDto {
    return {
      id: record.id,
      recordNumber: record.recordNumber,
      patient: record.patient
        ? PatientResponseDto.fromEntity(record.patient)
        : (null as unknown as PatientResponseDto),
      doctor: record.doctor
        ? DoctorResponseDto.fromEntity(record.doctor)
        : (null as unknown as DoctorResponseDto),
      patientId: record.patientId,
      doctorId: record.doctorId || undefined,
      appointmentId: record.appointmentId,
      appointment: record.appointment
        ? AppointmentResponseDto.fromEntity(record.appointment)
        : undefined,
      chiefComplaint: record.chiefComplaint || undefined,
      presentIllnessHistory: record.presentIllness || undefined,
      pastMedicalHistory: record.medicalHistory || undefined,
      physicalExamNotes: record.physicalExamNotes || undefined,
      assessment: record.assessment || undefined,
      diagnosisNotes: record.diagnosisNotes || undefined,
      treatmentPlan: record.treatmentPlan || undefined,
      status: record.appointment?.status || 'UNKNOWN',
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
      doctorId: prescription.doctorId || undefined,
      medicalRecordId: prescription.medicalRecordId || undefined,
      appointmentId: prescription.appointmentId || undefined,
      diagnosis: diagnosisName,
      notes: prescription.notes || undefined,
      status: prescription.status || undefined,
      items: items,
      createdAt: prescription.createdAt,
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
    const diagnosis = (prescription as { diagnosis?: { name?: unknown } })
      .diagnosis;
    if (diagnosis && typeof diagnosis.name === 'string') {
      return diagnosis.name;
    }

    return undefined;
  }

  // ============================================================================
  // CRUD ENDPOINTS
  // ============================================================================

  @Get()
  @Roles(RoleEnum.ADMIN, RoleEnum.DOCTOR)
  @ApiOperation({
    summary: 'Lấy danh sách bệnh nhân (Admin/Doctor)',
    description:
      'Hỗ trợ phân trang, tìm kiếm theo tên/phone/mã bệnh nhân, lọc theo nhóm máu',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'bloodType', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách bệnh nhân',
    type: PaginatedPatientResponseDto,
  })
  async findAll(
    @Query() query: PatientQueryDto,
  ): Promise<ResponseCommon<PaginatedPatientResponseDto>> {
    const result = await this.patientService.findAll(query);
    const fallback = {
      items: [] as Patient[],
      meta: {
        currentPage: query.page || 1,
        itemsPerPage: query.limit || 10,
        totalItems: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    const data = (result.data ?? fallback) as {
      items: Patient[];
      meta: PaginatedPatientResponseDto['meta'];
    };
    const items = (data.items || []).map((p) => this.toPatientDto(p));

    return new ResponseCommon(result.code, result.message, {
      items,
      meta: data.meta,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin bệnh nhân của user hiện tại' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin bệnh nhân',
    type: PatientResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không phải bệnh nhân',
  })
  async getMe(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientResponseDto>> {
    if (!user.patientId) {
      throw new ForbiddenException(PATIENT_ERRORS.NOT_PATIENT);
    }
    const result = await this.patientService.findOne(user.patientId);
    return new ResponseCommon(
      result.code,
      result.message,
      this.toPatientDto(result.data as Patient),
    );
  }

  @Get('me/profile')
  @ApiOperation({ summary: 'Lấy hồ sơ bệnh nhân với thống kê tổng hợp' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hồ sơ bệnh nhân với summary',
    type: PatientProfileResponseDto,
  })
  async getMyProfile(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientProfileResponseDto>> {
    if (!user.patientId) {
      throw new ForbiddenException(PATIENT_ERRORS.NOT_PATIENT);
    }
    const result = await this.patientService.getProfile(user.patientId);

    const data = result.data as {
      patient: Patient;
      summary: {
        totalMedicalRecords: number;
        totalVitalSigns: number;
        totalPrescriptions: number;
        latestVitalSign?: VitalSign | null;
      };
    };
    const patientDto = this.toPatientDto(data.patient);
    const summary = {
      ...data.summary,
      latestVitalSign: data.summary.latestVitalSign
        ? this.toVitalSignDto(data.summary.latestVitalSign)
        : null,
    };

    return new ResponseCommon(result.code, result.message, {
      patient: patientDto,
      summary,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Lấy thông tin bệnh nhân theo ID (Admin/Doctor/Chính mình)',
  })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Thông tin bệnh nhân',
    type: PatientResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Bệnh nhân không tồn tại',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientResponseDto>> {
    const isAdminOrDoctor =
      user.roles?.includes(RoleEnum.ADMIN) ||
      user.roles?.includes(RoleEnum.DOCTOR);
    const isOwner = user.patientId === id;

    if (!isAdminOrDoctor && !isOwner) {
      throw new ForbiddenException(
        'Bạn không có quyền xem thông tin bệnh nhân này',
      );
    }

    const result = await this.patientService.findOne(id);
    return new ResponseCommon(
      result.code,
      result.message,
      this.toPatientDto(result.data as Patient),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin bệnh nhân (Admin/Chính mình)' })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cập nhật thành công',
    type: PatientResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền cập nhật',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientResponseDto>> {
    const isAdmin = user.roles?.includes(RoleEnum.ADMIN);
    const isOwner = user.patientId === id;

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Bạn chỉ có thể cập nhật thông tin của mình',
      );
    }

    const result = await this.patientService.update(id, dto);
    return new ResponseCommon(
      result.code,
      result.message,
      this.toPatientDto(result.data as Patient),
    );
  }

  // ============================================================================
  // MEDICAL DATA ENDPOINTS
  // ============================================================================

  @Get(':id/medical-records')
  @ApiOperation({ summary: 'Lấy danh sách hồ sơ bệnh án của bệnh nhân' })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách hồ sơ bệnh án',
    type: [MedicalRecordResponseDto],
  })
  async getMedicalRecords(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordResponseDto[]>> {
    this.checkPatientAccess(id, user);
    const result = await this.patientService.getMedicalRecords(id);
    const records = (result.data ?? []) as MedicalRecord[];
    const dtos = records.map((r) => this.toRecordDto(r));
    return new ResponseCommon(result.code, result.message, dtos);
  }

  @Get(':id/vital-signs')
  @ApiOperation({ summary: 'Lấy lịch sử chỉ số sinh tồn của bệnh nhân' })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lịch sử chỉ số sinh tồn',
    type: [VitalSignResponseDto],
  })
  async getVitalSigns(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<VitalSignResponseDto[]>> {
    this.checkPatientAccess(id, user);
    const result = await this.patientService.getVitalSigns(id);
    const vitalSigns = (result.data ?? []) as VitalSign[];
    const dtos = vitalSigns.map((vs) => this.toVitalSignDto(vs));
    return new ResponseCommon(result.code, result.message, dtos);
  }

  @Get(':id/prescriptions')
  @ApiOperation({ summary: 'Lấy danh sách đơn thuốc của bệnh nhân' })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách đơn thuốc',
    type: [PrescriptionResponseDto],
  })
  async getPrescriptions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PrescriptionResponseDto[]>> {
    this.checkPatientAccess(id, user);
    const result = await this.patientService.getPrescriptions(id);
    const prescriptions = (result.data ?? []) as Prescription[];
    const dtos = prescriptions.map((p) => this.toPrescriptionDto(p));
    return new ResponseCommon(result.code, result.message, dtos);
  }

  @Get(':id/appointments')
  @ApiOperation({ summary: 'Lấy danh sách lịch hẹn của bệnh nhân' })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách lịch hẹn',
    type: PaginatedAppointmentResponseDto,
  })
  async getAppointments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: { page?: number; limit?: number; status?: string },
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PaginatedAppointmentResponseDto>> {
    this.checkPatientAccess(id, user);
    const status =
      query.status &&
      Object.values(AppointmentStatusEnum).includes(
        query.status as AppointmentStatusEnum,
      )
        ? (query.status as AppointmentStatusEnum)
        : undefined;
    const result = await this.patientService.getAppointments(id, {
      page: query.page,
      limit: query.limit,
      status,
    });
    return result as unknown as ResponseCommon<PaginatedAppointmentResponseDto>;
  }

  @Get(':id/profile')
  @ApiOperation({
    summary: 'Lấy hồ sơ tổng hợp bệnh nhân (thông tin + thống kê)',
  })
  @ApiParam({ name: 'id', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Hồ sơ bệnh nhân với summary',
    type: PatientProfileResponseDto,
  })
  async getProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PatientProfileResponseDto>> {
    this.checkPatientAccess(id, user);
    const result = await this.patientService.getProfile(id);

    const data = result.data as {
      patient: Patient;
      summary: {
        totalMedicalRecords: number;
        totalVitalSigns: number;
        totalPrescriptions: number;
        latestVitalSign?: VitalSign | null;
      };
    };
    const patientDto = this.toPatientDto(data.patient);
    const summary = {
      ...data.summary,
      latestVitalSign: data.summary.latestVitalSign
        ? this.toVitalSignDto(data.summary.latestVitalSign)
        : null,
    };

    return new ResponseCommon(result.code, result.message, {
      patient: patientDto,
      summary,
    });
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private checkPatientAccess(patientId: string, user: JwtUser): void {
    const isAdminOrDoctor =
      user.roles?.includes(RoleEnum.ADMIN) ||
      user.roles?.includes(RoleEnum.DOCTOR);
    const isOwner = user.patientId === patientId;

    if (!isAdminOrDoctor && !isOwner) {
      throw new ForbiddenException(
        'Bạn không có quyền xem thông tin bệnh nhân này',
      );
    }
  }
}
