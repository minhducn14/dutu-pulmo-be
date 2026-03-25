import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In, DataSource, MoreThan } from 'typeorm';
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
import { MedicalRecordSummaryDto } from '@/modules/medical/dto/medical-record-summary.dto';
import { plainToInstance } from 'class-transformer';
import { ScreeningRequestResponseDto } from '@/modules/screening/dto/screening-request-response.dto';
import { UpdateMedicalRecordDto } from '@/modules/medical/dto/update-medical-record.dto';
import { SignMedicalRecordDto } from '@/modules/medical/dto/sign-medical-record.dto';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { PrescriptionStatusEnum } from '@/modules/common/enums/prescription-status.enum';
import { MedicalRecordStatusEnum } from '@/modules/common/enums/medical-record-status.enum';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { MedicalRecordExaminationDto } from '@/modules/medical/dto/medical-record-examination.dto';
import { PdfService } from '@/modules/pdf/pdf.service';
import { validateTextFieldsPolicy as applyTextFieldsPolicy } from '@/common/utils/text-fields-policy.util';
import { NotificationService } from '@/modules/notification/notification.service';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';
import { AppointmentMedicalAccessService } from '@/modules/appointment/services/appointment-medical-access.service';
import { MedicalAuditService } from './medical-audit.service';
import { AuditAction } from './enums/audit-action.enum';
import { AuditEntityType } from './enums/audit-entity-type.enum';
import { AuditActorRole } from './enums/audit-actor-role.enum';

const VALID_TRANSITIONS: Record<
  MedicalRecordStatusEnum,
  MedicalRecordStatusEnum[]
> = {
  [MedicalRecordStatusEnum.DRAFT]: [
    MedicalRecordStatusEnum.IN_PROGRESS,
    MedicalRecordStatusEnum.COMPLETED,
  ],
  [MedicalRecordStatusEnum.IN_PROGRESS]: [MedicalRecordStatusEnum.COMPLETED],
  [MedicalRecordStatusEnum.COMPLETED]: [MedicalRecordStatusEnum.IN_PROGRESS],
};

const REOPEN_WINDOW_HOURS = 48;

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
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => PdfService))
    private readonly pdfService: PdfService,

    private readonly notificationService: NotificationService,
    @Inject(forwardRef(() => AppointmentMedicalAccessService))
    private readonly accessService: AppointmentMedicalAccessService,
    private readonly auditService: MedicalAuditService,
  ) {}

  // ============================================================================
  // MEDICAL RECORDS
  // ============================================================================

  async findById(id: string): Promise<MedicalRecord> {
    const record = await this.recordRepository.findOne({
      where: { id },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'appointment',
        'vitalSigns',
        'prescriptions',
        'prescriptions.items',
        'prescriptions.items.medicine',
      ],
    });
    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }
    return record;
  }

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
      ],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(HttpStatus.OK, 'Thành công', records);
  }

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

  /**
   * Find records by doctor (History View for Doctor)
   */
  async findRecordsByDoctor(
    doctorId: string,
  ): Promise<ResponseCommon<MedicalRecord[]>> {
    const records = await this.recordRepository.find({
      where: { doctorId },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'appointment',
        'vitalSigns',
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return new ResponseCommon(HttpStatus.OK, 'Thành công', records);
  }

  async createRecord(
    data: Partial<MedicalRecord>,
    user?: JwtUser,
  ): Promise<ResponseCommon<MedicalRecord>> {
    const record = this.recordRepository.create({
      ...data,
      recordNumber: this.generateRecordNumber(),
    });
    const result = await this.recordRepository.save(record);

    const { actorId, actorRole } = this.getAuditActorInfo(user);
    this.auditService.log({
      entityType: AuditEntityType.MEDICAL_RECORD,
      entityId: result.id,
      medicalRecordId: result.id,
      patientId: result.patientId,
      actorId,
      actorRole,
      action: AuditAction.CREATE_RECORD,
      metadata: { recordNumber: result.recordNumber },
    });

    return new ResponseCommon(
      HttpStatus.CREATED,
      'Tạo hồ sơ thành công',
      result,
    );
  }

  async updateMedicalRecord(
    id: string,
    data: UpdateMedicalRecordDto,
    user?: JwtUser,
  ): Promise<ResponseCommon<MedicalRecord>> {
    const record = await this.recordRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    this.assertNotCompleted(record);

    if (data.previousRecordId !== undefined) {
      await this.validateLinking(id, record.patientId, data.previousRecordId);
    }

    const before = { ...record };
    Object.assign(record, data);
    const result = await this.recordRepository.save(record);

    const { actorId, actorRole } = this.getAuditActorInfo(user);
    this.auditService.log({
      entityType: AuditEntityType.MEDICAL_RECORD,
      entityId: result.id,
      medicalRecordId: result.id,
      patientId: result.patientId,
      actorId,
      actorRole,
      action: AuditAction.UPDATE_RECORD,
      metadata: {
        diff: this.getDiff(before, result, Object.keys(data)),
      },
    });

    return new ResponseCommon(HttpStatus.OK, 'Cập nhật thành công', result);
  }

  async completeMedicalRecord(
    id: string,
    user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecord>> {
    const record = await this.recordRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    if (
      user.roles?.includes(RoleEnum.DOCTOR) &&
      !user.roles.includes(RoleEnum.ADMIN)
    ) {
      if (record.doctorId !== user.doctorId) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
      }
    }

    const fromStatus = record.status;
    this.validateTransition(fromStatus, MedicalRecordStatusEnum.COMPLETED);

    record.status = MedicalRecordStatusEnum.COMPLETED;
    record.completedAt = new Date();

    const result = await this.recordRepository.save(record);

    const { actorId, actorRole } = this.getAuditActorInfo(user);
    this.auditService.log({
      entityType: AuditEntityType.MEDICAL_RECORD,
      entityId: result.id,
      medicalRecordId: result.id,
      patientId: result.patientId,
      actorId,
      actorRole,
      action: AuditAction.COMPLETE_RECORD,
      metadata: { from: fromStatus, to: result.status },
    });

    return new ResponseCommon(
      HttpStatus.OK,
      'Bệnh án đã được hoàn tất',
      result,
    );
  }

  async reopenMedicalRecord(
    id: string,
    user: JwtUser,
  ): Promise<ResponseCommon<MedicalRecord>> {
    const record = await this.recordRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    const fromStatus = record.status;
    this.validateTransition(fromStatus, MedicalRecordStatusEnum.IN_PROGRESS);

    if (
      user.roles?.includes(RoleEnum.DOCTOR) &&
      !user.roles.includes(RoleEnum.ADMIN)
    ) {
      if (record.doctorId !== user.doctorId) {
        throw new ForbiddenException(ERROR_MESSAGES.REOPEN_FORBIDDEN);
      }

      const completedAt = record.completedAt;
      if (!completedAt) {
        throw new BadRequestException(ERROR_MESSAGES.REOPEN_WINDOW_EXPIRED);
      }

      const hoursSinceCompleted =
        (Date.now() - completedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceCompleted > REOPEN_WINDOW_HOURS) {
        throw new ForbiddenException(ERROR_MESSAGES.REOPEN_WINDOW_EXPIRED);
      }
    }

    record.status = MedicalRecordStatusEnum.IN_PROGRESS;
    record.completedAt = null;

    const result = await this.recordRepository.save(record);

    const { actorId, actorRole } = this.getAuditActorInfo(user);
    this.auditService.log({
      entityType: AuditEntityType.MEDICAL_RECORD,
      entityId: result.id,
      medicalRecordId: result.id,
      patientId: result.patientId,
      actorId,
      actorRole,
      action: AuditAction.REOPEN_RECORD,
      metadata: { from: fromStatus, to: result.status },
    });

    return new ResponseCommon(HttpStatus.OK, 'Bệnh án đã được mở lại', result);
  }

  private assertNotCompleted(record: MedicalRecord): void {
    if (record.status === MedicalRecordStatusEnum.COMPLETED) {
      throw new BadRequestException(ERROR_MESSAGES.MEDICAL_RECORD_COMPLETED);
    }
  }

  private validateTransition(
    from: MedicalRecordStatusEnum,
    to: MedicalRecordStatusEnum,
  ): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        ERROR_MESSAGES.INVALID_RECORD_STATUS_TRANSITION,
      );
    }
  }

  private assertUserCanAccessRecord(
    record: Pick<MedicalRecord, 'patientId' | 'doctorId'>,
    user: JwtUser,
  ): void {
    if (user.roles?.includes(RoleEnum.PATIENT)) {
      if (user.patientId !== record.patientId) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
      }
      return;
    }

    if (user.roles?.includes(RoleEnum.DOCTOR)) {
      if (user.doctorId !== record.doctorId) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
      }
      return;
    }

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
    }
  }

  private getLatestVitalSignFromCollection(
    vitalSigns?: VitalSign[] | null,
  ): VitalSign | null {
    if (!vitalSigns?.length) {
      return null;
    }

    return vitalSigns
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }

  private parsePrescriptionDurationDays(duration: string): number {
    const match = duration.match(/\d+/);
    const durationDays = match ? Number(match[0]) : NaN;

    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    return durationDays;
  }

  // ============================================================================
  // VITAL SIGNS
  // ============================================================================

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
      qb.andWhere('mr.doctorId = :doctorId', { doctorId });
    }

    qb.orderBy('vs.createdAt', 'DESC');
    qb.take(100);

    const data = await qb.getMany();
    return new ResponseCommon(HttpStatus.OK, 'Thành công', data);
  }

  async findVitalSignsByPatientRaw(patientId: string): Promise<VitalSign[]> {
    return this.vitalSignRepository.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  private validateTextFieldsPolicy(data: Partial<MedicalRecord>): void {
    applyTextFieldsPolicy({
      chiefComplaint: data.chiefComplaint,
      textFields: [
        data.presentIllness,
        data.physicalExamNotes,
        data.assessment,
        data.diagnosis,
        data.treatmentPlan,
        data.medicalHistory,
        data.surgicalHistory,
        data.familyHistory,
        data.followUpInstructions,
        data.progressNotes,
      ],
      base64ErrorCode:
        ERROR_MESSAGES.MEDICAL_RECORD_BASE64_NOT_ALLOWED_IN_TEXT_FIELDS,
      chiefComplaintErrorCode:
        ERROR_MESSAGES.MEDICAL_RECORD_CHIEF_COMPLAINT_PLAIN_TEXT_ONLY,
    });
  }

  // ============================================================================
  // PRESCRIPTIONS
  // ============================================================================

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
      relations: [
        'items',
        'doctor',
        'doctor.user',
        'patient',
        'patient.user',
        'medicalRecord',
        'appointment',
      ],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(HttpStatus.OK, 'Thành công', data);
  }

  async findPrescriptionsByPatientRaw(
    patientId: string,
  ): Promise<Prescription[]> {
    return this.prescriptionRepository.find({
      where: { patientId },
      relations: ['items', 'doctor', 'medicalRecord', 'appointment'],
      order: { createdAt: 'DESC' },
    });
  }

  async findPrescriptionsByDoctor(
    doctorId: string,
  ): Promise<ResponseCommon<Prescription[]>> {
    const data = await this.prescriptionRepository.find({
      where: { doctorId },
      relations: [
        'items',
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'medicalRecord',
        'appointment',
      ],
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return new ResponseCommon(HttpStatus.OK, 'Thành công', data);
  }

  async getPrescriptionDetail(
    id: string,
    user: JwtUser,
  ): Promise<ResponseCommon<Prescription>> {
    const prescription = await this.prescriptionRepository.findOne({
      where: { id },
      relations: [
        'items',
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'medicalRecord',
        'appointment',
      ],
    });

    if (!prescription) {
      throw new NotFoundException(ERROR_MESSAGES.PRESCRIPTION_NOT_FOUND);
    }

    if (user.roles?.includes(RoleEnum.PATIENT)) {
      if (prescription.patient?.user?.id !== user.userId) {
        throw new ForbiddenException(ERROR_MESSAGES.PRESCRIPTION_NOT_FOUND);
      }
    }

    if (user.roles?.includes(RoleEnum.DOCTOR)) {
      if (prescription.doctor?.user?.id !== user.userId) {
        throw new ForbiddenException(ERROR_MESSAGES.PRESCRIPTION_NOT_FOUND);
      }
    }
    return new ResponseCommon(HttpStatus.OK, 'Thành công', prescription);
  }

  async generateMedicalRecordPdf(
    recordId: string,
    user: JwtUser,
  ): Promise<string> {
    const record = await this.recordRepository.findOne({
      where: { id: recordId },
      select: {
        id: true,
        patientId: true,
        doctorId: true,
      },
    });

    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    this.assertUserCanAccessRecord(record, user);
    return this.pdfService.generateAndSaveMedicalRecordPdf(recordId);
  }

  async generatePrescriptionPdf(
    prescriptionId: string,
    user: JwtUser,
  ): Promise<string> {
    await this.getPrescriptionDetail(prescriptionId, user);
    return this.pdfService.generateAndSavePrescriptionPdf(prescriptionId);
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

  async upsertEncounterInTx(
    manager: EntityManager,
    appointment: Appointment,
  ): Promise<{ record: MedicalRecord; created: boolean }> {
    let record = await manager.findOne(MedicalRecord, {
      where: { appointmentId: appointment.id },
    });
    let created = false;

    if (!record) {
      // Prefill only once from appointment data. Do not overwrite once a record exists.
      record = manager.create(MedicalRecord, {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        recordNumber: this.generateRecordNumber(),
        chiefComplaint: appointment.chiefComplaint ?? null,
        presentIllness: appointment.patientNotes ?? null,
      });
      record = await manager.save(record);
      created = true;
    }

    return { record, created };
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
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
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
    user?: JwtUser,
  ): Promise<ResponseCommon<MedicalRecord>> {
    let auditPayload: Parameters<MedicalAuditService['log']>[0] | null = null;

    const response = await this.dataSource.transaction(async (manager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id: appointmentId },
      });
      if (!appointment) {
        throw new NotFoundException(ERROR_MESSAGES.APPOINTMENT_NOT_FOUND);
      }

      let record = await manager.findOne(MedicalRecord, {
        where: { appointmentId },
      });

      if (record) {
        this.accessService.validateMedicalRecordStatus(record.status, 'EDIT');
      } else {
        const canCreate = [
          AppointmentStatusEnum.IN_PROGRESS,
          AppointmentStatusEnum.CHECKED_IN,
          AppointmentStatusEnum.CONFIRMED,
        ].includes(appointment.status);

        if (!canCreate) {
          throw new BadRequestException(
            ERROR_MESSAGES.CANNOT_CREATE_RECORD_WITH_STATUS,
          );
        }
      }

      this.validateTextFieldsPolicy(data);

      const before = record ? { ...record } : null;
      if (!record) {
        record = manager.create(MedicalRecord, {
          appointmentId: appointment.id,
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          progressNotes: data.progressNotes || null,
          recordNumber: this.generateRecordNumber(),
          chiefComplaint:
            data.chiefComplaint || appointment.chiefComplaint || null,
          presentIllness:
            data.presentIllness || appointment.patientNotes || null,
          medicalHistory: data.medicalHistory || null,
          physicalExamNotes: data.physicalExamNotes || null,
          assessment: data.assessment || null,
          treatmentPlan: data.treatmentPlan || null,
          diagnosis: data.diagnosis || null,
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
          previousRecordId: data.previousRecordId || null,
        });
        record = await manager.save(record);
      }

      if (data.previousRecordId !== undefined) {
        await this.validateLinking(
          record.id,
          record.patientId,
          data.previousRecordId,
        );
      }

      Object.assign(record, data);
      const result = await manager.save(record);

      const { actorId, actorRole } = this.getAuditActorInfo(user);
      auditPayload = {
        entityType: AuditEntityType.MEDICAL_RECORD,
        entityId: result.id,
        medicalRecordId: result.id,
        patientId: result.patientId,
        actorId,
        actorRole,
        action: before ? AuditAction.UPDATE_RECORD : AuditAction.CREATE_RECORD,
        metadata: before
          ? { diff: this.getDiff(before, result, Object.keys(data)) }
          : { recordNumber: result.recordNumber },
      };

      let apptChanged = false;
      if (
        data.chiefComplaint &&
        data.chiefComplaint !== appointment.chiefComplaint
      ) {
        appointment.chiefComplaint = data.chiefComplaint;
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

      if (!result.previousRecordId) {
        const suggested = await this.getSuggestedPreviousRecord(
          result.patientId,
          result.id,
          result.recordType,
        );
        if (suggested) {
          (result as any).suggestedPreviousRecordId = suggested.id;
        }
      }

      return new ResponseCommon(HttpStatus.OK, 'Cập nhật thành công', result);
    });

    if (auditPayload) {
      this.auditService.log(auditPayload);
    }

    return response;
  }

  // ============================================================================
  // ENCOUNTER-BASED VITAL SIGNS & PRESCRIPTIONS
  // ============================================================================

  async addVitalSignToEncounter(
    encounterId: string,
    patientId: string,
    data: Partial<VitalSign>,
  ): Promise<ResponseCommon<VitalSign>> {
    const record = await this.recordRepository.findOne({
      where: { id: encounterId },
    });
    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }
    this.assertNotCompleted(record);

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
    user: JwtUser,
  ): Promise<ResponseCommon<Prescription>> {
    if (!data.items?.length) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    let auditPayload: Parameters<MedicalAuditService['log']>[0] | null = null;

    const result = await this.dataSource.transaction(async (manager) => {
      const recordRepo = manager.getRepository(MedicalRecord);
      const prescriptionRepo = manager.getRepository(Prescription);
      const itemRepo = manager.getRepository(PrescriptionItem);
      const medicineRepo = manager.getRepository(Medicine);

      const record = await recordRepo.findOne({
        where: { id: encounterId },
      });
      if (!record) {
        throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
      }
      this.assertNotCompleted(record);

      if (data.diagnosis !== undefined) {
        record.diagnosis = data.diagnosis;
        await recordRepo.save(record);
      }

      const savedPrescription = await prescriptionRepo.save(
        prescriptionRepo.create({
          prescriptionNumber: this.generatePrescriptionNumber(),
          patientId,
          doctorId,
          medicalRecordId: encounterId,
          appointmentId,
          notes: data.notes,
        }),
      );

      const medicineIds = data.items
        .map((item) => item.medicineId)
        .filter(Boolean) as string[];
      let medicineMap = new Map<string, Medicine>();
      if (medicineIds.length > 0) {
        const medicines = await medicineRepo.findBy({
          id: In(medicineIds),
        });
        medicineMap = new Map(
          medicines.map((medicine) => [medicine.id, medicine]),
        );
      }

      const startDate = new Date();

      const itemEntities = data.items.map((item) => {
        let finalName = item.medicineName;
        let finalUnit = item.unit;
        if (item.medicineId) {
          const medicine = medicineMap.get(item.medicineId);
          if (!medicine) {
            throw new NotFoundException(ERROR_MESSAGES.MEDICINE_NOT_FOUND);
          }
          finalName = medicine.name;
          finalUnit = finalUnit || medicine.unit;
        } else {
          if (!finalName) {
            throw new BadRequestException(
              ERROR_MESSAGES.MEDICINE_NAME_REQUIRED,
            );
          }
        }

        const durationDays = this.parsePrescriptionDurationDays(item.duration);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + durationDays);

        return itemRepo.create({
          prescription: savedPrescription,
          medicineId: item.medicineId || undefined,
          medicineName: finalName,
          dosage: item.dosage,
          frequency: item.frequency,
          durationDays,
          quantity: item.quantity || 0,
          instructions: item.instructions,
          startDate,
          endDate,
          unit: finalUnit || 'viên',
        });
      });

      await itemRepo.save(itemEntities);

      const result = await prescriptionRepo.findOne({
        where: { id: savedPrescription.id },
        relations: ['items', 'doctor', 'medicalRecord', 'appointment'],
      });

      auditPayload = {
        ...this.getAuditActorInfo(user),
        entityType: AuditEntityType.PRESCRIPTION,
        entityId: savedPrescription.id,
        medicalRecordId: encounterId,
        patientId,
        action: AuditAction.CREATE_PRESCRIPTION,
        metadata: { prescriptionNumber: savedPrescription.prescriptionNumber },
      };

      return result as Prescription;
    });

    if (auditPayload) {
      this.auditService.log(auditPayload);
    }

    return new ResponseCommon(HttpStatus.CREATED, 'Ke don thanh cong', result);
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
      throw new NotFoundException(ERROR_MESSAGES.PRESCRIPTION_NOT_FOUND);
    }

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.DOCTOR)) {
        if (prescription.doctor?.id !== user.doctorId) {
          throw new ForbiddenException(
            ERROR_MESSAGES.CANCEL_PRESCRIPTION_FORBIDDEN,
          );
        }
      } else {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
      }
    }

    if (prescription.status === PrescriptionStatusEnum.FILLED) {
      throw new BadRequestException(ERROR_MESSAGES.CANNOT_CANCEL_DISPENSED);
    }

    prescription.status = PrescriptionStatusEnum.CANCELLED;
    const result = await this.prescriptionRepository.save(prescription);

    const { actorId, actorRole } = this.getAuditActorInfo(user);
    this.auditService.log({
      entityType: AuditEntityType.PRESCRIPTION,
      entityId: result.id,
      medicalRecordId: result.medicalRecordId,
      patientId: result.patientId,
      actorId,
      actorRole,
      action: AuditAction.CANCEL_PRESCRIPTION,
      metadata: { from: PrescriptionStatusEnum.ACTIVE, to: result.status },
    });

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
      throw new NotFoundException(ERROR_MESSAGES.PRESCRIPTION_NOT_FOUND);
    }

    if (!user.roles?.includes(RoleEnum.ADMIN)) {
      if (user.roles?.includes(RoleEnum.DOCTOR)) {
        if (prescription.doctor?.id !== user.doctorId) {
          throw new ForbiddenException(
            ERROR_MESSAGES.EDIT_PRESCRIPTION_FORBIDDEN,
          );
        }
      } else {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_MEDICAL);
      }
    }

    if (prescription.status !== PrescriptionStatusEnum.ACTIVE) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_PRESCRIPTION_STATUS);
    }

    if (!dto.items?.length) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    prescription.notes = dto.notes ?? prescription.notes;

    await this.dataSource.transaction(async (manager) => {
      const prescriptionRepo = manager.getRepository(Prescription);
      const itemRepo = manager.getRepository(PrescriptionItem);
      const medicineRepo = manager.getRepository(Medicine);
      const recordRepo = manager.getRepository(MedicalRecord);

      await prescriptionRepo.save(prescription);
      await itemRepo.delete({ prescriptionId });

      const medicineIds = dto.items
        .map((i) => i.medicineId)
        .filter(Boolean) as string[];
      let medicineMap = new Map<string, Medicine>();
      if (medicineIds.length > 0) {
        const medicines = await medicineRepo.findBy({
          id: In(medicineIds),
        });
        medicineMap = new Map(medicines.map((m) => [m.id, m]));
      }

      if (dto.diagnosis !== undefined && prescription.medicalRecordId) {
        await recordRepo.update(prescription.medicalRecordId, {
          diagnosis: dto.diagnosis,
        });
      }

      const startDate = new Date();
      const itemEntities = dto.items.map((item) => {
        let finalName = item.medicineName;
        let finalUnit = item.unit;
        if (item.medicineId) {
          const medicine = medicineMap.get(item.medicineId);
          if (!medicine) {
            throw new NotFoundException(ERROR_MESSAGES.MEDICINE_NOT_FOUND);
          }
          finalName = medicine.name;
          finalUnit = finalUnit || medicine.unit;
        } else if (!finalName) {
          throw new BadRequestException(ERROR_MESSAGES.MEDICINE_NAME_REQUIRED);
        }

        const durationDays = this.parsePrescriptionDurationDays(item.duration);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + durationDays);

        return itemRepo.create({
          prescription,
          medicineId: item.medicineId || undefined,
          medicineName: finalName,
          dosage: item.dosage,
          frequency: item.frequency,
          durationDays,
          quantity: item.quantity || 0,
          instructions: item.instructions,
          startDate,
          endDate,
          unit: finalUnit || 'viên',
        });
      });

      await itemRepo.save(itemEntities);
    });

    const result = await this.prescriptionRepository.findOne({
      where: { id: prescriptionId },
      relations: ['items', 'doctor', 'medicalRecord', 'appointment'],
    });

    return new ResponseCommon(
      HttpStatus.OK,
      'Cập nhật đơn thuốc thành công',
      result as Prescription,
    );
  }

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
        'screeningRequests',
        'previousRecord',
        'previousRecord.doctor',
        'previousRecord.doctor.user',
        'screeningRequests.uploadedByDoctor',
        'screeningRequests.images',
        'screeningRequests.aiAnalyses',
        'screeningRequests.conclusions',
      ],
    });

    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    this.assertUserCanAccessRecord(record, user);

    const latestVitalSign = this.getLatestVitalSignFromCollection(
      record.vitalSigns,
    );

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
        String(record.signedStatus) === 'SIGNED'
          ? SignedStatusEnum.SIGNED
          : SignedStatusEnum.NOT_SIGNED,
      signedAt: record.signedAt || undefined,
      digitalSignature: record.digitalSignature || undefined,
      recordType: record.recordType || 'Bệnh án Ngoại trú chung',
      diagnosis: record.diagnosis || undefined,
      chiefComplaint: record.chiefComplaint || undefined,
      vitalSigns: {
        temperature:
          latestVitalSign?.temperature != null
            ? Number(latestVitalSign.temperature)
            : undefined,
        respiratoryRate: latestVitalSign?.respiratoryRate ?? undefined,
        weight: latestVitalSign?.weight ?? undefined,
        bloodPressure: latestVitalSign?.bloodPressure ?? undefined,
        heartRate: latestVitalSign?.heartRate ?? undefined,
        height: latestVitalSign?.height ?? undefined,
        bmi:
          latestVitalSign?.bmi != null
            ? Number(latestVitalSign.bmi)
            : undefined,
        spo2: latestVitalSign?.spo2 ?? undefined,
      },
      presentIllness: record.presentIllness || undefined,
      medicalHistory: record.medicalHistory || undefined,
      familyHistory: record.familyHistory || undefined,
      physicalExamNotes: record.physicalExamNotes || undefined,
      systemsReview: record.systemsReview || undefined,
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
              durationDays: item.durationDays,
              instructions: item.instructions || undefined,
              startDate: item.startDate || undefined,
              endDate: item.endDate || undefined,
            })) || [],
          notes: p.notes || undefined,
          instructions: p.instructions || undefined,
          pdfUrl: p.pdfUrl || undefined,
          createdAt: p.createdAt,
        })) || [],
      progressNotes: record.progressNotes || undefined,
      primaryDiagnosis: record.primaryDiagnosis || undefined,
      secondaryDiagnosis: record.secondaryDiagnosis || undefined,
      treatmentPlan: record.treatmentPlan || undefined,
      dischargeCondition: record.dischargeCondition || undefined,
      followUpInstructions: record.followUpInstructions || undefined,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      previousRecordId: record.previousRecordId || undefined,
      previousRecord: record.previousRecord
        ? {
            id: record.previousRecord.id,
            recordNumber: record.previousRecord.recordNumber,
            createdAt: record.previousRecord.createdAt,
            doctorName: record.previousRecord.doctor?.user?.fullName,
            recordType: record.previousRecord.recordType,
          }
        : undefined,
    };

    if (!record.previousRecordId) {
      const suggested = await this.getSuggestedPreviousRecord(
        record.patientId,
        record.id,
        record.recordType,
      );
      if (suggested) {
        response.suggestedPreviousRecordId = suggested.id;
        response.suggestedPreviousRecord = {
          id: suggested.id,
          recordNumber: suggested.recordNumber,
          createdAt: suggested.createdAt,
          doctorName: suggested.doctor?.user?.fullName,
          recordType: suggested.recordType,
        };
      }
    }

    response.surgicalHistory = record.surgicalHistory || undefined;
    response.allergies = record.allergies || undefined;
    response.chronicDiseases = record.chronicDiseases || undefined;
    response.currentMedications = record.currentMedications || undefined;
    response.smokingStatus = record.smokingStatus ?? undefined;
    response.smokingYears = record.smokingYears ?? undefined;
    response.alcoholConsumption = record.alcoholConsumption ?? undefined;
    response.assessment = record.assessment || undefined;
    response.pdfUrl = record.pdfUrl || undefined;
    response.screeningRequests =
      record.screeningRequests?.map((sr) =>
        ScreeningRequestResponseDto.fromEntity(sr),
      ) || [];

    const transformedResponse = plainToInstance(
      MedicalRecordDetailResponseDto,
      response,
    );

    return new ResponseCommon(HttpStatus.OK, 'Thành công', transformedResponse);
  }

  // ============================================================================
  // DIGITAL SIGNATURE
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
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    if (
      !user.roles?.includes(RoleEnum.ADMIN) &&
      user.doctorId !== record.doctorId
    ) {
      throw new ForbiddenException(ERROR_MESSAGES.SIGN_FORBIDDEN);
    }

    if (record.appointment?.status !== AppointmentStatusEnum.COMPLETED) {
      throw new BadRequestException(ERROR_MESSAGES.SIGN_COMPLETED_ONLY);
    }

    const signedStatus = record.signedStatus as SignedStatusEnum;
    if (signedStatus === SignedStatusEnum.SIGNED) {
      throw new BadRequestException(ERROR_MESSAGES.ALREADY_SIGNED);
    }

    const previousSigningState = {
      signedStatus: record.signedStatus,
      signedAt: record.signedAt,
      digitalSignature: record.digitalSignature,
    };

    record.signedStatus = SignedStatusEnum.SIGNED;
    record.signedAt = new Date();
    record.digitalSignature = dto.signature;

    await this.recordRepository.save(record);

    try {
      await this.pdfService.generateAndSaveMedicalRecordPdf(recordId);
    } catch (error) {
      record.signedStatus = previousSigningState.signedStatus;
      record.signedAt = previousSigningState.signedAt;
      record.digitalSignature = previousSigningState.digitalSignature;
      await this.recordRepository.save(record);
      throw error;
    }

    const { actorId, actorRole } = this.getAuditActorInfo(user);
    this.auditService.log({
      entityType: AuditEntityType.MEDICAL_RECORD,
      entityId: record.id,
      medicalRecordId: record.id,
      patientId: record.patientId,
      actorId,
      actorRole,
      action: AuditAction.SIGN_RECORD,
      metadata: { signedAt: record.signedAt },
    });

    const recordWithPatient = await this.recordRepository.findOne({
      where: { id: recordId },
      relations: ['patient', 'patient.user'],
    });
    if (recordWithPatient?.patient?.user?.id) {
      void this.notificationService.createNotification({
        userId: recordWithPatient.patient.user.id,
        type: NotificationTypeEnum.MEDICAL,
        title: 'Bệnh án đã được ký số',
        content:
          'Hồ sơ bệnh án của bạn đã được bác sĩ ký số. PDF đã sẵn sàng để tải xuống.',
        refId: recordId,
        refType: 'MEDICAL_RECORD',
      });
    }

    return this.getMedicalRecordDetail(recordId, user);
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
      relations: ['patient', 'patient.user', 'vitalSigns', 'appointment'],
    });

    if (!record) {
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    this.assertUserCanAccessRecord(record, user);

    const latestVitalSign = this.getLatestVitalSignFromCollection(
      record.vitalSigns,
    );

    const recentRecords = await this.recordRepository.find({
      where: { patientId: record.patientId },
      order: { createdAt: 'DESC' },
      take: 4,
      relations: ['doctor', 'doctor.user'],
      select: {
        id: true,
        recordNumber: true,
        createdAt: true,
        diagnosis: true,
        doctor: {
          id: true,
          user: {
            fullName: true,
          },
        },
      },
    });

    const recent = recentRecords
      .filter((r) => r.id !== recordId)
      .slice(0, 3)
      .map((r) => ({
        id: r.id,
        recordNumber: r.recordNumber,
        visitDate: r.createdAt,
        diagnosis: r.diagnosis || 'N/A',
        doctor: r.doctor?.user?.fullName || 'N/A',
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
      latestVitalSign: latestVitalSign
        ? {
            temperature:
              latestVitalSign.temperature != null
                ? Number(latestVitalSign.temperature)
                : undefined,
            bloodPressure: latestVitalSign.bloodPressure,
            heartRate: latestVitalSign.heartRate,
            spo2:
              latestVitalSign.spo2 != null
                ? Number(latestVitalSign.spo2)
                : undefined,
            weight: latestVitalSign.weight,
            height: latestVitalSign.height,
            bmi:
              latestVitalSign.bmi != null
                ? Number(latestVitalSign.bmi)
                : undefined,
            recordedAt: latestVitalSign.createdAt,
          }
        : undefined,
      chiefComplaint: record.chiefComplaint || undefined,
      presentIllness: record.presentIllness || undefined,
      physicalExamNotes: record.physicalExamNotes || undefined,
      assessment: record.assessment || undefined,
      diagnosis: record.diagnosis || undefined,
      treatmentPlan: record.treatmentPlan || undefined,
      recentRecords: recent,
      status: record.status,
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
      throw new NotFoundException(ERROR_MESSAGES.MEDICAL_RECORD_NOT_FOUND);
    }

    this.assertUserCanAccessRecord(record, user);

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
      primaryDiagnosis: record.primaryDiagnosis || undefined,
      secondaryDiagnosis: record.secondaryDiagnosis || undefined,
      dischargeDiagnosis: record.dischargeDiagnosis || undefined,
      progressNotes: record.progressNotes || undefined,
      treatmentGiven: record.treatmentGiven || undefined,
      dischargeCondition: record.dischargeCondition || undefined,
      followUpInstructions: record.followUpInstructions || undefined,
      prescriptions:
        record.prescriptions?.map((p) => ({
          id: p.id,
          prescriptionNumber: p.prescriptionNumber,
          diagnosis: record.diagnosis || undefined,
          createdAt: p.createdAt,
        })) || [],
      status: record.status || '',
    };

    return new ResponseCommon(HttpStatus.OK, 'Thành công', response);
  }

  private async validateLinking(
    recordId: string,
    patientId: string,
    previousRecordId: string | null,
  ): Promise<void> {
    if (!previousRecordId) return;

    if (recordId === previousRecordId) {
      throw new BadRequestException('Hồ sơ không thể liên kết với chính nó');
    }

    const previousRecord = await this.recordRepository.findOne({
      where: { id: previousRecordId },
      select: { id: true, patientId: true, status: true },
    });

    if (!previousRecord) {
      throw new NotFoundException('Hồ sơ liên kết không tồn tại');
    }

    if (previousRecord.patientId !== patientId) {
      throw new BadRequestException(
        'Chỉ có thể liên kết hồ sơ của cùng một bệnh nhân',
      );
    }

    // Cycle detection
    await this.checkCycle(recordId, previousRecordId);
  }

  private async checkCycle(
    recordId: string,
    previousRecordId: string,
    depth = 0,
  ): Promise<void> {
    const MAX_DEPTH = 50;
    if (depth > MAX_DEPTH) {
      throw new BadRequestException('Chuỗi liên kết quá dài hoặc bị vòng lặp');
    }

    if (recordId === previousRecordId) {
      throw new BadRequestException(
        'Phát hiện vòng lặp liên kết (Cycle detected)',
      );
    }

    const prev = await this.recordRepository.findOne({
      where: { id: previousRecordId },
      select: { id: true, previousRecordId: true },
    });

    if (prev?.previousRecordId) {
      await this.checkCycle(recordId, prev.previousRecordId, depth + 1);
    }
  }

  /**
   * Suggests the most relevant previous record for linking.
   * Priority:
   * 1. Latest COMPLETED record with SAME recordType
   * 2. Latest COMPLETED record (any type)
   * Fallback: Latest record (any status, except current one) if no completed found.
   */
  async getSuggestedPreviousRecord(
    patientId: string,
    currentRecordId?: string,
    currentRecordType?: string,
  ): Promise<MedicalRecord | null> {
    const qb = this.recordRepository.createQueryBuilder('record');
    qb.where('record.patientId = :patientId', { patientId });
    if (currentRecordId) {
      qb.andWhere('record.id != :currentRecordId', { currentRecordId });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Attempt 1: Same type + COMPLETED + within 6 months
    if (currentRecordType) {
      const sameTypeCompleted = await this.recordRepository.findOne({
        where: {
          patientId,
          recordType: currentRecordType,
          status: MedicalRecordStatusEnum.COMPLETED,
          createdAt: MoreThan(sixMonthsAgo),
        },
        relations: ['doctor', 'doctor.user'],
        order: { createdAt: 'DESC' },
      });
      if (sameTypeCompleted && sameTypeCompleted.id !== currentRecordId) {
        return sameTypeCompleted;
      }
    }

    // Attempt 2: Any type + COMPLETED + within 6 months
    const anyCompleted = await this.recordRepository.findOne({
      where: {
        patientId,
        status: MedicalRecordStatusEnum.COMPLETED,
        createdAt: MoreThan(sixMonthsAgo),
      },
      relations: ['doctor', 'doctor.user'],
      order: { createdAt: 'DESC' },
    });

    if (anyCompleted && anyCompleted.id !== currentRecordId) {
      return anyCompleted;
    }

    // Attempt 3: Fallback to any latest (still within 6 months)
    const latest = await this.recordRepository.findOne({
      where: {
        patientId,
        createdAt: MoreThan(sixMonthsAgo),
      },
      relations: ['doctor', 'doctor.user'],
      order: { createdAt: 'DESC' },
    });

    if (latest && latest.id !== currentRecordId) {
      return latest;
    }

    return null;
  }

  // ============================================================================
  // AUDIT HELPERS
  // ============================================================================

  private getAuditActorInfo(user?: JwtUser): {
    actorId: string;
    actorRole: AuditActorRole;
  } {
    if (!user) {
      return {
        actorId: '00000000-0000-0000-0000-000000000000',
        actorRole: AuditActorRole.SYSTEM,
      };
    }
    let role = AuditActorRole.SYSTEM;
    if (user.roles?.includes(RoleEnum.ADMIN)) role = AuditActorRole.ADMIN;
    else if (user.roles?.includes(RoleEnum.DOCTOR))
      role = AuditActorRole.DOCTOR;
    else if (user.roles?.includes(RoleEnum.RECEPTIONIST))
      role = AuditActorRole.ADMIN;

    return { actorId: user.userId, actorRole: role };
  }

  logAutoCreatedEncounter(
    record: Pick<MedicalRecord, 'id' | 'patientId' | 'recordNumber'>,
  ): void {
    this.auditService.log({
      entityType: AuditEntityType.MEDICAL_RECORD,
      entityId: record.id,
      medicalRecordId: record.id,
      patientId: record.patientId,
      actorId: '00000000-0000-0000-0000-000000000000',
      actorRole: AuditActorRole.SYSTEM,
      action: AuditAction.CREATE_RECORD,
      metadata: {
        recordNumber: record.recordNumber,
        reason: 'Auto-created from appointment status change',
      },
    });
  }

  private getDiff(
    before: Record<string, any>,
    after: Record<string, any>,
    keys: string[],
  ): Record<string, { old: any; new: any }> {
    const diff: Record<string, { old: any; new: any }> = {};
    for (const key of keys) {
      if (before[key] !== after[key]) {
        diff[key] = {
          old: before[key],
          new: after[key],
        };
      }
    }
    return diff;
  }
}
