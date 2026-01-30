import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReportType } from '@/modules/report/entities/report.entity';

export class CreateReportDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: 'e320aa67-b53b-4c4a-bd50-31e8b312defa',
    description: 'ID bác sĩ bị báo cáo',
  })
  doctorId?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: 'a120bb78-c64c-5d5b-ce61-42f9c423efgb',
    description: 'ID cuộc hẹn bị báo cáo',
  })
  appointmentId?: string;

  @IsOptional()
  @IsEnum(ReportType)
  @ApiPropertyOptional({
    enum: ReportType,
    example: ReportType.DOCTOR,
    description: 'Loại báo cáo: doctor, appointment, system',
  })
  reportType?: ReportType;

  @IsString()
  @ApiProperty({
    example: 'Bác sĩ không đến đúng giờ hẹn',
    description: 'Nội dung báo cáo chi tiết',
  })
  content: string;
}
