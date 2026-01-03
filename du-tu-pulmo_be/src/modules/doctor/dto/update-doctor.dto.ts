import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateDoctorDto } from './create-doctor.dto';

// Omit registration fields - those are set during creation only
export class UpdateDoctorDto extends PartialType(
  OmitType(CreateDoctorDto, ['email', 'password', 'fullName', 'phone'] as const),
) {}

