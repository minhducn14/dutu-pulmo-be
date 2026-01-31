import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { APPOINTMENT_AUTH_RELATIONS } from '@/modules/appointment/appointment.constants';

@Injectable()
export class AppointmentEntityService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
  ) {}

  findOne(id: string): Promise<Appointment | null> {
    return this.appointmentRepository.findOne({
      where: { id },
      relations: APPOINTMENT_AUTH_RELATIONS,
    });
  }

  async update(id: string, data: Partial<Appointment>): Promise<Appointment> {
    await this.appointmentRepository.update(id, data);
    const updated = await this.appointmentRepository.findOne({
      where: { id },
    });
    if (!updated) {
      throw new NotFoundException(`Appointment with ID ${id} not found`);
    }
    return updated;
  }

  async hasAnyAppointment(
    doctorId: string,
    patientId: string,
  ): Promise<boolean> {
    const count = await this.appointmentRepository.count({
      where: {
        doctorId,
        patientId,
      },
    });
    return count > 0;
  }
}
