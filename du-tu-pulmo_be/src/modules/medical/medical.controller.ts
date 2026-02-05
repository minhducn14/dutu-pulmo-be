import {
  Controller,
  Get,
  Param,
  HttpStatus,
  UseGuards,
  ForbiddenException,
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
import { SignMedicalRecordDto } from '@/modules/medical/dto/sign-medical-record.dto';
import { MEDICAL_ERRORS } from '@/common/constants/error-messages.constant';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { AppointmentService } from '@/modules/appointment/services/appointment.service';
import { ResponseCommon } from '@/common/dto/response.dto';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { DoctorResponseDto } from '@/modules/doctor/dto/doctor-response.dto';
import { PatientResponseDto } from '@/modules/patient/dto/patient-response.dto';

@ApiTags('Medical Records')
@Controller('medical')
@UseGuards(JwtAuthGuard, RolesGuard)
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
      throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
    }

    if (user.roles.includes(RoleEnum.ADMIN)) return;

    if (user.roles.includes(RoleEnum.PATIENT)) {
      if (user.patientId !== patientId) {
        throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
      }
      return;
    }

    if (user.roles.includes(RoleEnum.DOCTOR)) {
      if (!user.doctorId)
        throw new ForbiddenException(MEDICAL_ERRORS.DOCTOR_ID_INVALID);
      const hasAccess = await this.appointmentService.hasAnyAppointment(
        user.doctorId,
        patientId,
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          'Bạn chỉ có thể xem hồ sơ của bệnh nhân bạn đã khám',
        );
      }
      return;
    }

    throw new ForbiddenException('Không có quyền truy cập');
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

  // ==================== Medical Records ====================

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
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordResponseDto[]>> {
    let result: ResponseCommon<MedicalRecord[]>;

    if (user.roles?.includes(RoleEnum.PATIENT)) {
      if (user.patientId !== patientId)
        throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
      result = await this.medicalService.findRecordsByPatient(patientId);
    } else if (user.roles?.includes(RoleEnum.ADMIN)) {
      result = await this.medicalService.findRecordsByPatient(patientId);
    } else if (user.roles?.includes(RoleEnum.DOCTOR)) {
      if (!user.doctorId) throw new ForbiddenException(MEDICAL_ERRORS.DOCTOR_ID_MISSING);
      result = await this.medicalService.findRecordsByPatient(patientId);
    } else {
      throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
    }

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
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordDetailResponseDto>> {
    return this.medicalService.getMedicalRecordDetail(id, user);
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
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<VitalSignResponseDto[]>> {
    await this.validatePatientAccess(user, patientId);

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

  @Get('prescriptions/patient/:patientId')
  @ApiOperation({ summary: 'Lấy danh sách đơn thuốc của bệnh nhân' })
  @ApiParam({ name: 'patientId', description: 'Patient ID (UUID)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Danh sách đơn thuốc',
    type: [PrescriptionResponseDto],
  })
  async findPrescriptions(
    @Param('patientId') patientId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<PrescriptionResponseDto[]>> {
    await this.validatePatientAccess(user, patientId);

    const doctorId = user.roles?.includes(RoleEnum.DOCTOR)
      ? user.doctorId
      : undefined;

    const result = await this.medicalService.findPrescriptionsByPatient(
      patientId,
      doctorId,
    );
    const dtos = (result.data || []).map((p) => this.toPrescriptionDto(p));
    return new ResponseCommon(result.code, result.message, dtos);
  }
}
