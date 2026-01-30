import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ReportType,
  ReportStatus,
} from '@/modules/report/entities/report.entity';

export class ReportResponseDto {
  @ApiProperty({ example: '9c6c6b92-913c-4638-a2a6-54f8d3c4e3df' })
  id: string;

  @ApiProperty({ example: '3e4b78fd-24fa-4eac-a08a-236b6d2a9ee7' })
  reporterId: string;

  @ApiPropertyOptional({ example: '7c28a830-2341-4f0d-98ea-fb9b3b1f67c9' })
  doctorId?: string;

  @ApiPropertyOptional({ example: 'a120bb78-c64c-5d5b-ce61-42f9c423efgb' })
  appointmentId?: string;

  @ApiProperty({ enum: ReportType, example: ReportType.DOCTOR })
  reportType: ReportType;

  @ApiProperty({ example: 'Bác sĩ không đến đúng giờ hẹn' })
  content: string;

  @ApiProperty({ enum: ReportStatus, example: ReportStatus.PENDING })
  status: ReportStatus;

  @ApiPropertyOptional({ example: 'Đã liên hệ và xử lý với bác sĩ' })
  adminNotes?: string;

  @ApiPropertyOptional({ example: '2024-07-17T14:00:00.000Z' })
  resolvedAt?: Date;

  @ApiPropertyOptional({ example: 'admin-user-id' })
  resolvedBy?: string;

  @ApiProperty({
    example: '2024-07-16T13:10:30.000Z',
    description: 'Ngày tạo báo cáo',
  })
  createdAt: Date;

  static fromEntity(report: {
    id: string;
    reporterId?: string | null;
    doctorId?: string | null;
    appointmentId?: string | null;
    reportType: ReportType;
    content: string;
    status: ReportStatus;
    adminNotes?: string | null;
    resolvedAt?: Date | null;
    resolvedBy?: string | null;
    createdAt: Date;
  }): ReportResponseDto {
    const dto = new ReportResponseDto();
    dto.id = report.id;
    dto.reporterId = report.reporterId ?? '';
    dto.doctorId = report.doctorId ?? undefined;
    dto.appointmentId = report.appointmentId ?? undefined;
    dto.reportType = report.reportType;
    dto.content = report.content;
    dto.status = report.status;
    dto.adminNotes = report.adminNotes ?? undefined;
    dto.resolvedAt = report.resolvedAt ?? undefined;
    dto.resolvedBy = report.resolvedBy ?? undefined;
    dto.createdAt = report.createdAt;
    return dto;
  }

  static fromNullable(
    report:
      | Parameters<typeof ReportResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): ReportResponseDto | null {
    return report ? ReportResponseDto.fromEntity(report) : null;
  }
}
