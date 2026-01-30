import { Controller } from '@nestjs/common';
import { MedicineService } from '@/modules/medical/medicine.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Medicines')
@Controller('medicines')
export class MedicineController {
  constructor(private readonly medicineService: MedicineService) {}
}
