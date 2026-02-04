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

  @ApiProperty({ description: 'Số lượt khám hoàn thành' })
  visitCount: number;

  @ApiProperty({ description: 'Số đơn thuốc đã thanh toán' })
  prescriptions: number;

  @ApiProperty({ description: 'Số chỉ định xét nghiệm đã thanh toán' })
  labTests: number;
}

export class AppointmentStatsDto {
  @ApiProperty({ description: 'Số lượt khám tại phòng khám' })
  inClinic: number;

  @ApiProperty({ description: 'Số lượt khám trực tuyến (video)' })
  video: number;
}

export class PatientStatsDto {
  @ApiProperty({ description: 'Tổng số bệnh nhân unique' })
  total: number;

  @ApiProperty({ description: 'Số bệnh nhân mới (lần đầu khám với bác sĩ này)' })
  new: number;

  @ApiProperty({ description: 'Số bệnh nhân cũ (đã từng khám trước đó)' })
  returning: number;
}

export class DailyBreakdownDto {
  @ApiProperty({ description: 'Ngày (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: 'Số bệnh nhân mới' })
  newPatients: number;

  @ApiProperty({ description: 'Số bệnh nhân cũ' })
  returningPatients: number;

  @ApiProperty({ description: 'Tổng lượt khám trong ngày' })
  visits: number;
}

export class ComparisonStatsDto {
  @ApiProperty({ description: 'Thống kê kỳ trước' })
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
