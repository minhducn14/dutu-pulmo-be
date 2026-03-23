import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';

export enum DashboardPeriodEnum {
  TODAY = 'today',
  LAST_7_DAYS = '7days',
  LAST_30_DAYS = '30days',
}

export class DashboardQueryDto {
  @ApiPropertyOptional({
    enum: DashboardPeriodEnum,
    default: DashboardPeriodEnum.TODAY,
    description: 'Khoảng thời gian thống kê',
  })
  @IsOptional()
  @IsEnum(DashboardPeriodEnum)
  period?: DashboardPeriodEnum = DashboardPeriodEnum.TODAY;
}

export class PeriodInfoDto {
  @ApiProperty({ description: 'Ngày bắt đầu kỳ hiện tại' })
  start: Date;

  @ApiProperty({ description: 'Ngày kết thúc kỳ hiện tại' })
  end: Date;

  @ApiProperty({ enum: DashboardPeriodEnum })
  type: DashboardPeriodEnum;
}

export class RevenueStatsDto {
  @ApiProperty({ description: 'Tổng doanh thu (VND)' })
  total: number;

  @ApiProperty({ description: 'Số lượt khám đã có payment' })
  visitCount: number;

  @ApiProperty({ description: 'Số đơn thuốc đã thanh toán' })
  prescriptions: number;

  @ApiProperty({ description: 'Số chỉ định xét nghiệm' })
  labTests: number;
}

export class AppointmentStatsDto {
  @ApiProperty({ description: 'Lượt khám tại phòng khám' })
  inClinic: number;

  @ApiProperty({ description: 'Lượt khám trực tuyến' })
  video: number;
}

export class PatientStatsDto {
  @ApiProperty({ description: 'Tổng số bệnh nhân DISTINCT đã đến' })
  total: number;

  @ApiProperty({
    description: 'Bệnh nhân mới (chưa từng COMPLETED trước kỳ) — distinct',
  })
  new: number;

  @ApiProperty({
    description: 'Bệnh nhân cũ (đã từng COMPLETED trước kỳ) — distinct',
  })
  returning: number;
}

export class DailyBreakdownDto {
  @ApiProperty({ description: 'Ngày (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: 'Số lượt khám của bệnh nhân MỚI trong ngày' })
  newVisits: number;

  @ApiProperty({ description: 'Số lượt khám của bệnh nhân CŨ trong ngày' })
  returningVisits: number;

  @ApiProperty({
    description: 'Tổng lượt khám trong ngày (newVisits + returningVisits)',
  })
  totalVisits: number;

  @ApiProperty({
    description: 'Alias của totalVisits — dành cho line chart FE',
  })
  visits: number;

  @ApiProperty({
    description:
      'Số bệnh nhân MỚI DISTINCT trong ngày — nhất quán với PatientStatsDto.new',
  })
  newPatients: number;

  @ApiProperty({
    description:
      'Số bệnh nhân CŨ DISTINCT trong ngày — nhất quán với PatientStatsDto.returning',
  })
  returningPatients: number;
}

export class ComparisonStatsDto {
  @ApiProperty({ description: 'Số liệu kỳ trước' })
  previousPeriod: {
    revenue: number;
    visitCount: number;
    inClinic: number;
    video: number;
    totalPatients: number;
  };

  @ApiProperty({ description: 'Phần trăm thay đổi so với kỳ trước' })
  percentChange: {
    revenue: number;
    visitCount: number;
    inClinic: number;
    video: number;
    totalPatients: number;
  };
}

export class DashboardStatsDto {
  @ApiProperty({ type: PeriodInfoDto })
  period: PeriodInfoDto;

  @ApiProperty({ type: RevenueStatsDto })
  revenue: RevenueStatsDto;

  @ApiProperty({ type: AppointmentStatsDto })
  appointments: AppointmentStatsDto;

  @ApiProperty({ type: PatientStatsDto })
  patients: PatientStatsDto;

  @ApiProperty({ type: [DailyBreakdownDto] })
  dailyBreakdown: DailyBreakdownDto[];

  @ApiProperty({ type: ComparisonStatsDto })
  comparison: ComparisonStatsDto;
}
