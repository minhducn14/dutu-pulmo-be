import { Injectable } from '@nestjs/common';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { DoctorResponseDto } from '@/modules/doctor/dto/doctor-response.dto';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { PatientResponseDto } from '@/modules/patient/dto/patient-response.dto';

@Injectable()
export class AppointmentMapperService {
  toDto(entity: Appointment): AppointmentResponseDto {
    return AppointmentResponseDto.fromEntity(entity);
  }

  toDoctorDto(entity?: Doctor | null): DoctorResponseDto | null {
    return entity ? DoctorResponseDto.fromEntity(entity) : null;
  }

  toPatientDto(entity?: Patient | null): PatientResponseDto | null {
    return entity ? PatientResponseDto.fromEntity(entity) : null;
  }
}
