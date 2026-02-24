import { PartialType } from '@nestjs/swagger';
import { CreateMedicineDto } from '@/modules/medical/dto/create-medicine.dto';

export class UpdateMedicineDto extends PartialType(CreateMedicineDto) {}
