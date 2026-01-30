import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScreeningService } from './screening.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { FileValidationService } from './file-validation.service';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { PatientService } from '../patient/patient.service';

@ApiTags('Screening')
@Controller('screenings')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ScreeningController {
  constructor(
    private readonly screeningService: ScreeningService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly fileValidationService: FileValidationService,
    private readonly patientService: PatientService,
  ) {}
}
