import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from './entities/medicine.entity';

@Injectable()
export class MedicineService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicineRepository: Repository<Medicine>,
  ) {}
}
