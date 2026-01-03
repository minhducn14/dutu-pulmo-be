import { PartialType } from '@nestjs/swagger';
import { CreateSubSpecialtyDto } from './create-sub-specialty.dto';

export class UpdateSubSpecialtyDto extends PartialType(CreateSubSpecialtyDto) {}
