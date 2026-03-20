import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '@/modules/report/entities/report.entity';
import { ReportService } from '@/modules/report/report.service';
import { ReportController } from '@/modules/report/report.controller';
import { Appointment } from '../appointment/entities/appointment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Report, Appointment])],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService, TypeOrmModule],
})
export class ReportModule {}
