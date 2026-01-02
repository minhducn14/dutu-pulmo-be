import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DoctorService } from './doctor.service';

@ApiTags('Doctors')
@Controller('doctors')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}
}
