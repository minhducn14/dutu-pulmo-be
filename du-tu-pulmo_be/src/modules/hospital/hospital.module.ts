import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hospital } from '@/modules/hospital/entities/hospital.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { HospitalService } from '@/modules/hospital/hospital.service';
import { HospitalController } from '@/modules/hospital/hospital.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Hospital, Doctor])],
  controllers: [HospitalController],
  providers: [HospitalService],
  exports: [HospitalService, TypeOrmModule],
})
export class HospitalModule {}
