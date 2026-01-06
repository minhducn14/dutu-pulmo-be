import { PartialType, OmitType, IntersectionType } from '@nestjs/swagger';
import { CreateDoctorDto } from './create-doctor.dto';
import { UpdateUserDto } from '../../user/dto/update-user.dto';

class UpdateDoctorUserFieldsDto extends OmitType(UpdateUserDto, [
  'status',
] as const) {}

class UpdateDoctorFieldsDto extends PartialType(
  OmitType(CreateDoctorDto, ['email', 'password', 'phone'] as const),
) {}

export class UpdateDoctorDto extends IntersectionType(
  UpdateDoctorFieldsDto,
  UpdateDoctorUserFieldsDto,
) {}
