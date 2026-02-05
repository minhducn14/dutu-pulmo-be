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
import { MEDICAL_ERRORS } from '@/common/constants/error-messages.constant';

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

}
