import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ScreeningService } from '@/modules/screening/screening.service';
import { CloudinaryService } from '@/modules/cloudinary/cloudinary.service';
import { FileValidationService } from '@/modules/screening/file-validation.service';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { PatientService } from '@/modules/patient/patient.service';

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
