import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecord } from './entities/medical-record.entity';
import { VitalSign } from './entities/vital-sign.entity';
import { Prescription } from './entities/prescription.entity';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { Medicine } from './entities/medicine.entity';
import { Appointment } from '../appointment/entities/appointment.entity';

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
  ) {}
}
