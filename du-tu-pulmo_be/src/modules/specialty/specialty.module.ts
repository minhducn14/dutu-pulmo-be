import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Specialty } from './entities/specialty.entity';
import { SubSpecialty } from './entities/sub-specialty.entity';
import { SpecialtyService } from './specialty.service';
import { SpecialtyController } from './specialty.controller';
import { SubSpecialtyController } from './sub-specialty.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Specialty, SubSpecialty])],
  controllers: [SpecialtyController, SubSpecialtyController],
  providers: [SpecialtyService],
  exports: [SpecialtyService, TypeOrmModule],
})
export class SpecialtyModule {}
