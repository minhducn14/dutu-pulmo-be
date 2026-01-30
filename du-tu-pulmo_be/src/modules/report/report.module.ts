import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Report } from '@/modules/report/entities/report.entity';
import { ReportService } from '@/modules/report/report.service';
import { ReportController } from '@/modules/report/report.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Report])],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService, TypeOrmModule],
})
export class ReportModule {}
