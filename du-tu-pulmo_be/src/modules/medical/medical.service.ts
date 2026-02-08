import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In, DataSource } from 'typeorm';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { VitalSign } from '@/modules/medical/entities/vital-sign.entity';
import { Prescription } from '@/modules/medical/entities/prescription.entity';
import { PrescriptionItem } from '@/modules/medical/entities/prescription-item.entity';
import { Medicine } from '@/modules/medical/entities/medicine.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { ResponseCommon } from '@/common/dto/response.dto';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import {
  MedicalRecordDetailResponseDto,
  SignedStatusEnum,
} from '@/modules/medical/dto/get-medical-record-detail.dto';
import { MedicalRecordExaminationDto } from '@/modules/medical/dto/medical-record-examination.dto';
import { MedicalRecordSummaryDto } from '@/modules/medical/dto/medical-record-summary.dto';
import { SignMedicalRecordDto } from '@/modules/medical/dto/sign-medical-record.dto';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { PrescriptionStatusEnum } from '@/modules/common/enums/prescription-status.enum';
import { MEDICAL_ERRORS, APPOINTMENT_ERRORS } from '@/common/constants/error-messages.constant';

@Injectable()
export class MedicalService {
  constructor(
    @InjectRepository(MedicalRecord)
    private readonly recordRepository: Repository<MedicalRecord>,
    @InjectRepository(VitalSign)
    private readonly vitalSignRepository: Repository<VitalSign>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepository: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private readonly prescriptionItemRepository: Repository<PrescriptionItem>,
    @InjectRepository(Medicine)
    private readonly medicineRepository: Repository<Medicine>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly dataSource: DataSource,
  ) {}

  // Medical Records
  /**
   * Find records by patient, optionally filtered by doctor
   */
  async findRecordsByPatient(
    patientId: string,
    doctorId?: string,
  ): Promise<ResponseCommon<MedicalRecord[]>> {
    const where: { patientId: string; doctorId?: string } = { patientId };
    if (doctorId) {
      where.doctorId = doctorId;
    }
    const records = await this.recordRepository.find({
      where,
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'appointment',
        'patient',
        'vitalSigns',
        'prescriptions',
        'prescriptions.items',
        'prescriptions.items.medicine',
      ],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(HttpStatus.OK, 'Thành công', records);
  }

  // Internal helper for PatientService (Raw return)
  async findRecordsByPatientRaw(
    patientId: string,
    doctorId?: string,
  ): Promise<MedicalRecord[]> {
    const where: { patientId: string; doctorId?: string } = { patientId };
    if (doctorId) where.doctorId = doctorId;
    return this.recordRepository.find({
      where,
      relations: ['doctor', 'appointment'],
      order: { createdAt: 'DESC' },
    });
  }

  async createRecord(
    data: Partial<MedicalRecord>,
  ): Promise<ResponseCommon<MedicalRecord>> {
    const record = this.recordRepository.create({
      ...data,
      recordNumber: this.generateRecordNumber(),
    });
    const result = await this.recordRepository.save(record);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'Tạo hồ sơ thành công',
      result,
    );
  }

  // Vital Signs
  async addVitalSign(
    data: Partial<VitalSign>,
  ): Promise<ResponseCommon<VitalSign>> {
    const vitalSign = this.vitalSignRepository.create(data);
    const result = await this.vitalSignRepository.save(vitalSign);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'Ghi nhận thành công',
      result,
    );
  }

  /**
   * Find vital signs by patient, ensuring doctor access rules
   */
  async findVitalSignsByPatient(
    patientId: string,
    doctorId?: string,
  ): Promise<ResponseCommon<VitalSign[]>> {
    const qb = this.vitalSignRepository.createQueryBuilder('vs');
    qb.leftJoinAndSelect('vs.medicalRecord', 'mr');
    qb.where('vs.patientId = :patientId', { patientId });

    if (doctorId) {
      // Strict filtering: Only vital signs linked to records created by this doctor
      qb.andWhere('mr.doctorId = :doctorId', { doctorId });
    }

    qb.orderBy('vs.createdAt', 'DESC');
    qb.take(100);

    const data = await qb.getMany();
    return new ResponseCommon(HttpStatus.OK, 'Thành công', data);
  }

  // Internal for PatientService
  async findVitalSignsByPatientRaw(patientId: string): Promise<VitalSign[]> {
    return this.vitalSignRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  // Prescriptions
  async createPrescription(
    data: Partial<Prescription>,
  ): Promise<ResponseCommon<Prescription>> {
    const prescription = this.prescriptionRepository.create({
      ...data,
      prescriptionNumber: this.generatePrescriptionNumber(),
    });
    const result = await this.prescriptionRepository.save(prescription);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'Tạo đơn thuốc thành công',
      result,
    );
  }

  async addPrescriptionItem(
    data: Partial<PrescriptionItem>,
  ): Promise<ResponseCommon<PrescriptionItem>> {
    const item = this.prescriptionItemRepository.create(data);
    const result = await this.prescriptionItemRepository.save(item);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'Thêm thuốc thành công',
      result,
    );
  }

  async findPrescriptionsByPatient(
    patientId: string,
    doctorId?: string,
  ): Promise<ResponseCommon<Prescription[]>> {
    const where: { patientId: string; doctorId?: string } = { patientId };

    if (doctorId) {
      where.doctorId = doctorId;
    }

    const data = await this.prescriptionRepository.find({
      where,
      relations: ['items', 'doctor'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(HttpStatus.OK, 'Thành công', data);
  }

  // Internal for PatientService
  async findPrescriptionsByPatientRaw(
    patientId: string,
  ): Promise<Prescription[]> {
    return this.prescriptionRepository.find({
      where: { patientId },
      relations: ['items', 'doctor'],
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================================================
  // RECORD NUMBER GENERATION
  // ============================================================================

  private generateRecordNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `MR-${ts}-${rand}`;
  }

  private generatePrescriptionNumber(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `RX-${ts}-${rand}`;
  }

  // ============================================================================
  // ENCOUNTER MANAGEMENT
  // ============================================================================

  // KEEP RAW: Used in Transaction by AppointmentService
  async upsertEncounterInTx(
    manager: EntityManager,
    appointment: Appointment,
  ): Promise<MedicalRecord> {
    let record = await manager.findOne(MedicalRecord, {
      where: { appointmentId: appointment.id },
    });

    if (!record) {
      record = manager.create(MedicalRecord, {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        recordNumber: this.generateRecordNumber(),
        chiefComplaint: appointment.chiefComplaint ?? null,
        presentIllness: appointment.patientNotes ?? null,
      });
      record = await manager.save(record);
    }
    return record;
  }

  async getEncounterByAppointment(
    appointmentId: string,
  ): Promise<ResponseCommon<MedicalRecord>> {
    const record = await this.recordRepository.findOne({
      where: { appointmentId },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'appointment',
        'prescriptions',
        'prescriptions.items',
        'vitalSigns',
      ],
    });
    if (!record) {
      throw new NotFoundException(MEDICAL_ERRORS.MEDICAL_RECORD_NOT_FOUND);
    }
    return new ResponseCommon(HttpStatus.OK, 'Thành công', record);
  }

  async updateEncounterByAppointment(
    appointmentId: string,
    data: Partial<MedicalRecord> & {
      followUpRequired?: boolean;
      nextAppointmentDate?: string;
      followUpNotes?: string;
    },
  ): Promise<ResponseCommon<MedicalRecord>> {
    // Wrap in transaction to ensure atomicity between medical record and appointment updates
    return this.dataSource.transaction(async (manager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id: appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException(APPOINTMENT_ERRORS.APPOINTMENT_NOT_FOUND);
      }

      let record = await manager.findOne(MedicalRecord, {
        where: { appointmentId },
      });

      // Valid statuses for editing
      const canEdit = [
        AppointmentStatusEnum.IN_PROGRESS,
        AppointmentStatusEnum.COMPLETED,
        AppointmentStatusEnum.CHECKED_IN, // Allow prepping before start
        AppointmentStatusEnum.CONFIRMED, // Allow prepping before start
      ].includes(appointment.status);

      if (!canEdit && !record) {
        throw new BadRequestException(
          `Không thể tạo hồ sơ bệnh án khi lịch hẹn ở trạng thái ${appointment.status}`,
        );
      }

      if (!record) {
        // Create new if missing (Upsert)
        record = manager.create(MedicalRecord, {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          progressNotes: data.progressNotes || null,
          recordNumber: this.generateRecordNumber(),
          chiefComplaint:
            data.chiefComplaint || appointment.chiefComplaint || null,
          presentIllness: data.presentIllness || appointment.patientNotes || null,
          medicalHistory: data.medicalHistory || null,
          physicalExamNotes: data.physicalExamNotes || null,
          assessment: data.assessment || null,
          treatmentPlan: data.treatmentPlan || null,
          diagnosisNotes: data.diagnosisNotes || null,
          followUpRequired: data.followUpRequired || false,
          nextAppointmentDate: data.nextAppointmentDate || null,
          followUpNotes: data.followUpNotes || null,
          allergies: data.allergies || null,
          chronicDiseases: data.chronicDiseases || null,
          currentMedications: data.currentMedications || null,
          smokingStatus: data.smokingStatus || false,
          smokingYears: data.smokingYears || null,
          alcoholConsumption: data.alcoholConsumption || false,
          surgicalHistory: data.surgicalHistory || null,
          familyHistory: data.familyHistory || null,
        });
        record = await manager.save(record);
      }

      // Update fields
      Object.assign(record, data);

      // Only update sensitive fields if provided (don't overwrite with undefined if Partial)
      // Note: Object.assign handles this well for defined keys in data.

      const result = await manager.save(record);
      console.log(result);
      // Update appointment fields
      let apptChanged = false;
      if (
        data.chiefComplaint &&
        data.chiefComplaint !== appointment.chiefComplaint
      ) {
        appointment.chiefComplaint = data.chiefComplaint;
        apptChanged = true;
      }
      if (
        data.presentIllness &&
        data.presentIllness !== appointment.patientNotes
      ) {
        appointment.patientNotes = data.presentIllness;
        apptChanged = true;
      }
      if (
        data.followUpRequired !== undefined &&
        data.followUpRequired !== appointment.followUpRequired
      ) {
        appointment.followUpRequired = data.followUpRequired;
        apptChanged = true;
      }
      if (data.nextAppointmentDate) {
        appointment.nextAppointmentDate = new Date(data.nextAppointmentDate);
        apptChanged = true;
      }

      if (apptChanged) {
        await manager.save(appointment);
      }

      return new ResponseCommon(HttpStatus.OK, 'Cập nhật thành công', result);
    });
  }

  // ============================================================================
  // ENCOUNTER-BASED VITAL SIGNS & PRESCRIPTIONS
  // ============================================================================

  async addVitalSignToEncounter(
    encounterId: string,
    patientId: string,
    data: Partial<VitalSign>,
  ): Promise<ResponseCommon<VitalSign>> {
    const vitalSign = this.vitalSignRepository.create({
      ...data,
      patientId,
      medicalRecordId: encounterId,
    });
    const result = await this.vitalSignRepository.save(vitalSign);
    return new ResponseCommon(
      HttpStatus.CREATED,
      'Ghi nhận thành công',
      result,
    );
  }

  async createPrescriptionForEncounter(
    encounterId: string,
    patientId: string,
    doctorId: string,
    appointmentId: string,
    data: {
      diagnosis?: string;
      notes?: string;
      items: Array<{
        medicineId?: string;
        medicineName: string;
        dosage: string;
        frequency: string;
        duration: string;
        unit?: string;
        quantity?: number;
        instructions?: string;
      }>;
    },
  ): Promise<ResponseCommon<Prescription>> {
    const combinedNotes = [
      data.diagnosis ? `Chẩn đoán: ${data.diagnosis}` : null,
      data.notes,
    ]
      .filter(Boolean)
      .join('\n');

    const prescription = this.prescriptionRepository.create({
      prescriptionNumber: this.generatePrescriptionNumber(),
      patientId,
      doctorId,
      medicalRecordId: encounterId,
      appointmentId,
      notes: combinedNotes,
    });

    const savedPrescription =
      await this.prescriptionRepository.save(prescription);

    const medicineIds = data.items
      .map((i) => i.medicineId)
      .filter(Boolean) as string[];
    let medicineMap = new Map<string, Medicine>();
    if (medicineIds.length > 0) {
      const medicines = await this.medicineRepository.findBy({
        id: In(medicineIds),
      });
      medicineMap = new Map(medicines.map((m) => [m.id, m]));
    }

    const startDate = new Date();

    const itemEntities = data.items.map((item) => {
      let finalName = item.medicineName;
      let finalUnit = item.unit;
      if (item.medicineId) {
        const medicine = medicineMap.get(item.medicineId);
        if (!medicine) {
          throw new NotFoundException(
            MEDICAL_ERRORS.MEDICINE_NOT_FOUND,
          );
        }
        finalName = medicine.name;
        finalUnit = finalUnit || medicine.unit;
      } else {
        if (!finalName) {
          throw new BadRequestException(
            'Tên thuốc là bắt buộc nếu không chọn từ danh mục',
          );
        }
      }

      const durationDays = parseInt(item.duration) || 1;
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationDays);

      return this.prescriptionItemRepository.create({
        prescription: savedPrescription,
        medicineId: item.medicineId || undefined,
        medicineName: finalName,
        dosage: item.dosage,
        frequency: item.frequency,
        durationDays: durationDays,
        quantity: item.quantity || 0,
        instructions: item.instructions,
        startDate: startDate,
        endDate: endDate,
        unit: finalUnit || 'viên',
      });
    });

    await this.prescriptionItemRepository.save(itemEntities);

    const result = await this.prescriptionRepository.findOne({
      where: { id: savedPrescription.id },
      relations: ['items', 'doctor'],
    });

    return new ResponseCommon(
      HttpStatus.CREATED,
      'Kê đơn thành công',
      result as Prescription,
    );
  }

  async cancelPrescription(
    prescriptionId: string,
    user: JwtUser,
  ): Promise<ResponseCommon<Prescription>> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['doctor'],
    });

    if (!prescription) {
      throw new NotFoundException(MEDICAL_ERRORS.PRESCRIPTION_NOT_FOUND);
    }

    // Permission Check
    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.DOCTOR)) {
        if (prescription.doctor?.id !== user.doctorId) {
          throw new ForbiddenException(MEDICAL_ERRORS.CANCEL_PRESCRIPTION_FORBIDDEN);
        }
      } else {
        throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
      }
    }

    if (prescription.status === PrescriptionStatusEnum.FILLED) {
      throw new BadRequestException(MEDICAL_ERRORS.CANNOT_CANCEL_DISPENSED);
    }

    prescription.status = PrescriptionStatusEnum.CANCELLED;
    const result = await this.prescriptionRepository.save(prescription);

    return new ResponseCommon(
      HttpStatus.OK,
      'Hủy đơn thuốc thành công',
      result,
    );
  }

  async updatePrescription(
    prescriptionId: string,
    dto: {
      diagnosis?: string;
      notes?: string;
        items: Array<{
        medicineId?: string;
        medicineName: string;
        dosage: string;
        frequency: string;
        duration: string;
        unit?: string;
        quantity?: number;
        instructions?: string;
      }>;
    },
    user: JwtUser,
  ): Promise<ResponseCommon<Prescription>> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['doctor', 'items'],
    });

    if (!prescription) {
      throw new NotFoundException(MEDICAL_ERRORS.PRESCRIPTION_NOT_FOUND);
    }

    // Permission Check
    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.DOCTOR)) {
        if (prescription.doctor?.id !== user.doctorId) {
          throw new ForbiddenException(
            MEDICAL_ERRORS.EDIT_PRESCRIPTION_FORBIDDEN,
          );
        }
      } else {
        throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
      }
    }

    if (prescription.status !== PrescriptionStatusEnum.ACTIVE) {
      throw new BadRequestException(
        MEDICAL_ERRORS.INVALID_PRESCRIPTION_STATUS,
      );
    }

    // Prepare Update
    prescription.notes = dto.notes || '';

    // Transaction: Save Prescription -> Delete Items -> Create Items
    await this.prescriptionRepository.manager.transaction(async (manager) => {
      await manager.save(prescription);

      // Delete old items
      await manager.delete(PrescriptionItem, { prescriptionId });

      // Prepare new items
      const medicineIds = dto.items
        .map((i) => i.medicineId)
        .filter(Boolean) as string[];
      let medicineMap = new Map<string, Medicine>();
      if (medicineIds.length > 0) {
        const medicines = await this.medicineRepository.findBy({
          id: In(medicineIds),
        });
        medicineMap = new Map(medicines.map((m) => [m.id, m]));
      }

      const startDate = new Date();
      const itemEntities = dto.items.map((item) => {
        let finalName = item.medicineName;
        if (item.medicineId) {
          const medicine = medicineMap.get(item.medicineId);
          if (!medicine)
            throw new NotFoundException(
              MEDICAL_ERRORS.MEDICINE_NOT_FOUND,
            );
          finalName = medicine.name;
        }

        const durationDays = parseInt(item.duration) || 1;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + durationDays);

        return this.prescriptionItemRepository.create({
          prescription: prescription,
          medicineId: item.medicineId || undefined,
          medicineName: finalName,
          dosage: item.dosage,
          frequency: item.frequency,
          durationDays: durationDays,
          quantity: item.quantity || 0,
          instructions: item.instructions,
          startDate: startDate,
          endDate: endDate,
          unit: item.unit || 'viên',
        });
      });

      await manager.save(PrescriptionItem, itemEntities);
    });

    const result = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['items', 'doctor'],
    });

    return new ResponseCommon(
      HttpStatus.OK,
      'Cập nhật đơn thuốc thành công',
      result as Prescription,
    );
  }

  // KEEP RAW (Internal usage)
  async getLatestVitalSign(patientId: string): Promise<VitalSign | null> {
    return this.vitalSignRepository.findOne({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================================================
  // MEDICAL RECORD DETAIL (Read-only Page)
  // ============================================================================

  async getMedicalRecordDetail(
    recordId: string,
    user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordDetailResponseDto>> {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'appointment',
        'vitalSigns',
        'prescriptions',
        'prescriptions.items',
      ],
    });

    if (!record) {
      throw new NotFoundException(MEDICAL_ERRORS.MEDICAL_RECORD_NOT_FOUND);
    }

    // Permission check
    if (user.roles?.includes(RoleEnum.PATIENT)) {
      if (user.patientId !== record.patientId) {
        throw new ForbiddenException(
          MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL,
        );
      }
    } else if (user.roles?.includes(RoleEnum.DOCTOR)) {
      if (user.doctorId !== record.doctorId) {
        throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
      }
    } else if (!user.roles?.includes(RoleEnum.ADMIN)) {
      throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
    }

    // Get latest vital sign
    const latestVitalSign = record.vitalSigns?.[0] || ({} as VitalSign);

    // Build response
    const response: MedicalRecordDetailResponseDto = {
      id: record.id,
      recordNumber: record.recordNumber,
      patient: {
        id: record.patient.id,
        fullName: record.patient.user?.fullName || 'N/A',
        gender: record.patient.user?.gender || 'N/A',
        dateOfBirth: record.patient.user?.dateOfBirth || new Date(),
      },
      doctor: {
        id: record.doctor?.id || '',
        fullName: record.doctor?.user?.fullName || 'N/A',
      },
      appointment: {
        id: record.appointment?.id || '',
        appointmentNumber: record.appointment?.appointmentNumber || '',
        status: record.appointment?.status || '',
        scheduledAt: record.appointment?.scheduledAt || new Date(),
      },
      signedStatus:
        (record.signedStatus as SignedStatusEnum) ||
        SignedStatusEnum.NOT_SIGNED,
      signedAt: record.signedAt || undefined,
      digitalSignature: record.digitalSignature || undefined,
      recordType: record.recordType || 'Bệnh án Ngoại trú chung',
      specialty: record.specialty || undefined,
      createdAt: record.createdAt,
      patientCategory: record.patientCategory || undefined,
      insuranceNumber: record.insuranceNumber || undefined,
      insuranceExpiry: record.insuranceExpiry || undefined,
      emergencyContactName: record.emergencyContactName || undefined,
      emergencyContactPhone: record.emergencyContactPhone || undefined,
      emergencyContactAddress: record.emergencyContactAddress || undefined,
      referralDiagnosis: record.referralDiagnosis || undefined,
      chiefComplaint: record.chiefComplaint || undefined,
      vitalSigns: {
        pulse: latestVitalSign.heartRate,
        temperature: latestVitalSign.temperature
          ? Number(latestVitalSign.temperature)
          : undefined,
        respiratoryRate: latestVitalSign.respiratoryRate,
        weight: latestVitalSign.weight,
        bloodPressure: latestVitalSign.bloodPressure,
        heartRate: latestVitalSign.heartRate,
        height: latestVitalSign.height,
        bmi: latestVitalSign.bmi ? Number(latestVitalSign.bmi) : undefined,
      },
      presentIllness: record.presentIllness || undefined,
      medicalHistory: record.medicalHistory || undefined,
      familyHistory: record.familyHistory || undefined,
      physicalExamNotes: record.physicalExamNotes || undefined,
      systemsReview: record.systemsReview || undefined,
      labSummary: record.labSummary || undefined,
      initialDiagnosis: record.initialDiagnosis || undefined,
      treatmentGiven: record.treatmentGiven || undefined,
      dischargeDiagnosis: record.dischargeDiagnosis || undefined,
      treatmentStartDate: record.treatmentStartDate || undefined,
      treatmentEndDate: record.treatmentEndDate || undefined,
      prescriptions:
        record.prescriptions?.map((p) => ({
          id: p.id,
          prescriptionNumber: p.prescriptionNumber,
          items:
            p.items?.map((item) => ({
              medicineName: item.medicineName,
              quantity: item.quantity,
              unit: item.unit || 'viên',
              dosage: item.dosage,
              frequency: item.frequency,
              duration: `${item.durationDays} ngày`,
            })) || [],
          notes: p.notes || undefined,
          createdAt: p.createdAt,
        })) || [],
      progressNotes: record.progressNotes || undefined,
      significantLabFindings: record.significantLabFindings || undefined,
      primaryDiagnosis: record.primaryDiagnosis || undefined,
      secondaryDiagnosis: record.secondaryDiagnosis || undefined,
      treatmentPlan: record.treatmentPlan || undefined,
      dischargeCondition: record.dischargeCondition || undefined,
      followUpInstructions: record.followUpInstructions || undefined,
      imagingRecords: record.imagingRecords || undefined,
      status: record.appointment?.status || 'UNKNOWN',
      updatedAt: record.updatedAt,
      surgicalHistory: record.surgicalHistory || undefined,
      allergies: record.allergies || undefined,
      chronicDiseases: record.chronicDiseases || undefined,
      currentMedications: record.currentMedications || undefined,
      smokingStatus: record.smokingStatus || undefined,
      smokingYears: record.smokingYears || undefined,
      alcoholConsumption: record.alcoholConsumption || undefined,
      assessment: record.assessment || undefined,
    };

    return new ResponseCommon(HttpStatus.OK, 'Thành công', response);
  }

  // ============================================================================
  // DIGITAL SIGNATURE & PDF
  // ============================================================================

  async signMedicalRecord(
    recordId: string,
    dto: SignMedicalRecordDto,
    user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordDetailResponseDto>> {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: ['appointment'],
    });

    if (!record) {
      throw new NotFoundException(MEDICAL_ERRORS.MEDICAL_RECORD_NOT_FOUND);
    }

    // Check permission
    if (
      !user.roles?.includes(RoleEnum.ADMIN) &&
      user.doctorId !== record.doctorId
    ) {
      throw new ForbiddenException(MEDICAL_ERRORS.SIGN_FORBIDDEN);
    }

    // Check status
    if (record.appointment?.status !== AppointmentStatusEnum.COMPLETED) {
      throw new BadRequestException(MEDICAL_ERRORS.SIGN_COMPLETED_ONLY);
    }

    const signedStatus = record.signedStatus as SignedStatusEnum;
    if (signedStatus === SignedStatusEnum.SIGNED) {
      throw new BadRequestException(MEDICAL_ERRORS.ALREADY_SIGNED);
    }

    record.signedStatus = SignedStatusEnum.SIGNED;
    record.signedAt = new Date();
    record.digitalSignature = dto.signature;

    await this.recordRepository.save(record);

    await this.generatePdfInternal(recordId);

    return this.getMedicalRecordDetail(recordId, user);
  }

  async generatePdf(
    recordId: string,
    user: JwtUser,
  ): Promise<ResponseCommon<{ url: string }>> {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
    });

    if (!record) {
      throw new NotFoundException(MEDICAL_ERRORS.MEDICAL_RECORD_NOT_FOUND);
    }

    if (user.roles?.includes(RoleEnum.PATIENT)) {
      if (user.patientId !== record.patientId) {
        throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
      }
    } else if (user.roles?.includes(RoleEnum.DOCTOR)) {
      if (user.doctorId !== record.doctorId) {
        throw new ForbiddenException(MEDICAL_ERRORS.ACCESS_DENIED_MEDICAL);
      }
    } else if (!user.roles?.includes(RoleEnum.ADMIN)) {
      throw new ForbiddenException('Access denied');
    }

    if (record.signedStatus !== 'SIGNED') {
      throw new BadRequestException(MEDICAL_ERRORS.NOT_SIGNED);
    }

    if (record.pdfUrl) {
      return new ResponseCommon(HttpStatus.OK, 'Thành công', {
        url: record.pdfUrl,
      });
    }

    const pdfUrl = await this.generatePdfInternal(recordId);
    return new ResponseCommon(HttpStatus.OK, 'Thành công', { url: pdfUrl });
  }

  private async generatePdfInternal(recordId: string): Promise<string> {
    // TODO: Implement PDF generation logic
    // This would use a library like puppeteer, PDFKit, or call external service
    // For now, return placeholder URL
    const pdfUrl = `https://storage.example.com/medical-records/${recordId}.pdf`;

    await this.recordRepository.update(recordId, { pdfUrl });
    return pdfUrl;
  }

  // ============================================================================
  // SPECIALIZED VIEWS
  // ============================================================================

  async getMedicalRecordForExamination(
    recordId: string,
    user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordExaminationDto>> {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: [
        'patient',
        'patient.user',
        'vitalSigns',
        'appointment',
      ],
    });

    if (!record) {
      throw new NotFoundException(MEDICAL_ERRORS.MEDICAL_RECORD_NOT_FOUND);
    }

    // Permission: DOCTOR only (checked in controller)
    
    // Get latest vital sign
    const latestVitalSign = record.vitalSigns?.[0]; // Assuming order DESC

    // Get 3 recent records
    const recentRecords = await this.recordRepository.find({
      where: { patientId: record.patientId },
      order: { createdAt: 'DESC' },
      take: 4, // Take 4 to skip current if matches, or just take 3 recent
      relations: ['doctor', 'doctor.user'],
      select: {
        id: true,
        recordNumber: true,
        createdAt: true,
        diagnosisNotes: true,
        doctor: {
           id: true,
           user: {
             fullName: true
           }
        }
      }
    });
    
    // map recent records excluding current
    const recent = recentRecords
      .filter(r => r.id !== recordId)
      .slice(0, 3)
      .map(r => ({
        id: r.id,
        recordNumber: r.recordNumber,
        visitDate: r.createdAt,
        diagnosis: r.diagnosisNotes || 'N/A',
        doctor: r.doctor?.user?.fullName || 'N/A'
      }));

    const response: MedicalRecordExaminationDto = {
      id: record.id,
      recordNumber: record.recordNumber,
      patient: {
        id: record.patientId,
        fullName: record.patient?.user?.fullName || 'N/A',
        dateOfBirth: record.patient?.user?.dateOfBirth || new Date(),
        gender: record.patient?.user?.gender || 'N/A',
        phone: record.patient?.user?.phone || 'N/A',
        address: record.patient?.user?.address || 'N/A',
      },
      allergies: record.allergies || [],
      chronicDiseases: record.chronicDiseases || [],
      currentMedications: record.currentMedications || [],
      latestVitalSign: latestVitalSign ? {
        temperature: latestVitalSign.temperature ? Number(latestVitalSign.temperature) : undefined,
        bloodPressure: latestVitalSign.bloodPressure,
        heartRate: latestVitalSign.heartRate,
        spo2: latestVitalSign.spo2 ? Number(latestVitalSign.spo2) : undefined,
        weight: latestVitalSign.weight,
        height: latestVitalSign.height,
        bmi: latestVitalSign.bmi ? Number(latestVitalSign.bmi) : undefined,
        recordedAt: latestVitalSign.createdAt,
      } : undefined,
      chiefComplaint: record.chiefComplaint || undefined,
      presentIllness: record.presentIllness || undefined,
      physicalExamNotes: record.physicalExamNotes || undefined,
      assessment: record.assessment || undefined,
      diagnosisNotes: record.diagnosisNotes || undefined,
      treatmentPlan: record.treatmentPlan || undefined,
      recentRecords: recent,
      status: record.appointment?.status || 'UNKNOWN', // Or record status
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    return new ResponseCommon(HttpStatus.OK, 'Thành công', response);
  }

  async getMedicalRecordForSummary(
    recordId: string,
    user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecordSummaryDto>> {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'prescriptions',
      ],
    });

    if (!record) {
      throw new NotFoundException(MEDICAL_ERRORS.MEDICAL_RECORD_NOT_FOUND);
    }
    
    // Permission check done in controller or here if needed

    const response: MedicalRecordSummaryDto = {
      id: record.id,
      recordNumber: record.recordNumber,
      patient: {
        id: record.patientId,
        fullName: record.patient?.user?.fullName || 'N/A',
        dateOfBirth: record.patient?.user?.dateOfBirth || new Date(),
      },
      doctor: {
        id: record.doctorId || '',
        fullName: record.doctor?.user?.fullName || 'N/A',
      },
      treatmentStartDate: record.treatmentStartDate || undefined,
      treatmentEndDate: record.treatmentEndDate || undefined,
      initialDiagnosis: record.initialDiagnosis || undefined,
      primaryDiagnosis: record.primaryDiagnosis || undefined,
      secondaryDiagnosis: record.secondaryDiagnosis || undefined,
      dischargeDiagnosis: record.dischargeDiagnosis || undefined,
      progressNotes: record.progressNotes || undefined,
      treatmentGiven: record.treatmentGiven || undefined,
      significantLabFindings: record.significantLabFindings || undefined,
      dischargeCondition: record.dischargeCondition || undefined,
      followUpInstructions: record.followUpInstructions || undefined,
      prescriptions: record.prescriptions?.map(p => ({
        id: p.id,
        prescriptionNumber: p.prescriptionNumber,
        diagnosis: (p as any).diagnosis?.name || undefined,
        createdAt: p.createdAt,
      })) || [],
      status: record.status || '',
    };

    return new ResponseCommon(HttpStatus.OK, 'Thành công', response);
  }

}
