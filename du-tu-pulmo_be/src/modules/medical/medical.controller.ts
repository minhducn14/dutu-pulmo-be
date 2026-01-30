import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MedicalService } from './medical.service';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { AppointmentService } from '../appointment/appointment.service';

@ApiTags('Medical Records')
@Controller('medical')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class MedicalController {
  constructor(
    private readonly medicalService: MedicalService,
    private readonly appointmentService: AppointmentService,
  ) {}
}
