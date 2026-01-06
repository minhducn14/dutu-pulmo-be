import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hospital } from './entities/hospital.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { HospitalService } from './hospital.service';
import { HospitalController } from './hospital.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hospital,
      Doctor,
    ]),
  ],
  controllers: [HospitalController],
  providers: [HospitalService],
  exports: [HospitalService, TypeOrmModule],
})
export class HospitalModule {}

