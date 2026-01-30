import { PartialType } from '@nestjs/mapped-types';
import { CreateReportDto } from '@/modules/report/dto/create-report.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ReportStatus } from '@/modules/report/entities/report.entity';

export class UpdateReportDto extends PartialType(CreateReportDto) {
  @IsOptional()
  @IsEnum(ReportStatus)
  @ApiPropertyOptional({
    enum: ReportStatus,
    example: ReportStatus.RESOLVED,
    description: 'Trạng thái báo cáo',
  })
  status?: ReportStatus;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Đã liên hệ và xử lý với bác sĩ',
    description: 'Ghi chú của admin khi xử lý',
  })
  adminNotes?: string;
}
