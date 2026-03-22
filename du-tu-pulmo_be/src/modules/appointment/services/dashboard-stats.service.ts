import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import {
  Payment,
  PaymentStatus,
} from '@/modules/payment/entities/payment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { PaymentPurpose } from '@/modules/common/enums/payment-purpose.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import {
  DashboardPeriodEnum,
  DashboardStatsDto,
  RevenueStatsDto,
  AppointmentStatsDto,
  PatientStatsDto,
  DailyBreakdownDto,
  ComparisonStatsDto,
} from '@/modules/appointment/dto/dashboard-stats.dto';
import {
  startOfDayVN,
  endOfDayVN,
  vnNow,
  formatDateVN,
} from '@/common/datetime';

// ============================================================
// CONSTANTS — các status được coi là "đã đến khám"
// ============================================================
const VISITED_STATUSES = [
  AppointmentStatusEnum.CHECKED_IN,
  AppointmentStatusEnum.IN_PROGRESS,
  AppointmentStatusEnum.COMPLETED,
  AppointmentStatusEnum.CONFIRMED,
];

// ============================================================
// Types nội bộ — chỉ dùng trong service này
// ============================================================
interface PeriodDates {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
}

interface RevenueStatsRaw {
  total: string | number | null;
  visitCount: string | number | null;
  prescriptions: string | number | null;
  labTests: string | number | null;
}

interface AppointmentStatsRaw {
  inClinic: string | number | null;
  video: string | number | null;
}

interface PatientIdRaw {
  patientId: string;
}

// Raw row từ getDailyBreakdown query
interface DailyAppointmentRaw {
  date: string;
  patientId: string;
}

const PERIOD_DAYS = {
  LAST_7_DAYS: 7,
  LAST_30_DAYS: 30,
} as const;

@Injectable()
export class DashboardStatsService {
  private readonly logger = new Logger(DashboardStatsService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  // ============================================================
  // PUBLIC: Entry point duy nhất
  // ============================================================
  async getStats(
    doctorId: string,
    period: DashboardPeriodEnum = DashboardPeriodEnum.TODAY,
  ): Promise<ResponseCommon<DashboardStatsDto>> {
    try {
      const dates = this.calculatePeriodDates(period);

      const [revenue, appointments, patients, dailyBreakdown, prevStats] =
        await Promise.all([
          this.getRevenueStats(doctorId, dates.currentStart, dates.currentEnd),
          this.getAppointmentStats(
            doctorId,
            dates.currentStart,
            dates.currentEnd,
          ),
          this.getPatientStats(doctorId, dates.currentStart, dates.currentEnd),
          this.getDailyBreakdown(
            doctorId,
            dates.currentStart,
            dates.currentEnd,
          ),
          this.getPreviousPeriodStats(doctorId, dates.prevStart, dates.prevEnd),
        ]);

      const comparison = this.calculateComparison(
        { revenue, appointments, patients },
        prevStats,
      );

      const stats: DashboardStatsDto = {
        period: {
          start: dates.currentStart,
          end: dates.currentEnd,
          type: period,
        },
        revenue,
        appointments,
        patients,
        dailyBreakdown,
        comparison,
      };

      return new ResponseCommon(200, 'SUCCESS', stats);
    } catch (error) {
      this.logger.error(
        `Error getting dashboard stats for doctor ${doctorId}:`,
        error,
      );
      throw error;
    }
  }

  // ============================================================
  // PRIVATE: Tính khoảng thời gian kỳ hiện tại và kỳ trước
  // ============================================================
  private calculatePeriodDates(period: DashboardPeriodEnum): PeriodDates {
    const now = vnNow();
    switch (period) {
      case DashboardPeriodEnum.TODAY:
        return this.calculateTodayPeriod(now);
      case DashboardPeriodEnum.LAST_7_DAYS:
        return this.calculateRollingPeriod(now, PERIOD_DAYS.LAST_7_DAYS);
      case DashboardPeriodEnum.LAST_30_DAYS:
        return this.calculateRollingPeriod(now, PERIOD_DAYS.LAST_30_DAYS);
      default:
        return this.calculateTodayPeriod(now);
    }
  }

  private calculateTodayPeriod(now: Date): PeriodDates {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    return {
      currentStart: startOfDayVN(now),
      currentEnd: endOfDayVN(now),
      prevStart: startOfDayVN(yesterday),
      prevEnd: endOfDayVN(yesterday),
    };
  }

  private calculateRollingPeriod(now: Date, days: number): PeriodDates {
    const currentEnd = endOfDayVN(now);
    const currentStart = startOfDayVN(
      new Date(now.getTime() - (days - 1) * 86400000),
    );

    const prevEnd = endOfDayVN(new Date(currentStart.getTime() - 86400000));
    const prevStart = startOfDayVN(
      new Date(prevEnd.getTime() - (days - 1) * 86400000),
    );

    return { currentStart, currentEnd, prevStart, prevEnd };
  }

  private async getReturningPatientIds(
    doctorId: string,
    patientIds: string[],
    beforeDate: Date,
  ): Promise<Set<string>> {
    if (!patientIds.length) return new Set();

    const rows = await this.appointmentRepository
      .createQueryBuilder('a')
      .select('DISTINCT a.patientId', 'patientId')
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.status = :status', {
        status: AppointmentStatusEnum.COMPLETED, // chỉ ca đã kết thúc
      })
      .andWhere('a.scheduledAt < :beforeDate', { beforeDate }) // TRƯỚC kỳ này
      .andWhere('a.patientId IN (:...patientIds)', { patientIds })
      .getRawMany<PatientIdRaw>();

    return new Set(rows.map((r) => r.patientId));
  }

  // ============================================================
  // PRIVATE: Thống kê doanh thu
  // ============================================================
  private async getRevenueStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<RevenueStatsDto> {
    const result = await this.paymentRepository
      .createQueryBuilder('p')
      .innerJoin('p.appointment', 'a')
      .select([
        'COALESCE(SUM(p.amount), 0) as total',
        'COUNT(DISTINCT a.id) as visitCount',
        `COUNT(CASE WHEN p.purpose = '${PaymentPurpose.PRESCRIPTION}' THEN 1 END) as prescriptions`,
        `COUNT(CASE WHEN p.purpose = '${PaymentPurpose.LAB_TEST}' THEN 1 END) as labTests`,
      ])
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('p.status = :status', { status: PaymentStatus.PAID })
      .andWhere('a.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getRawOne<RevenueStatsRaw>();

    return {
      total: Number(result?.total) || 0,
      visitCount: Number(result?.visitCount) || 0,
      prescriptions: Number(result?.prescriptions) || 0,
      labTests: Number(result?.labTests) || 0,
    };
  }

  // ============================================================
  // PRIVATE: Thống kê lượt khám (IN_CLINIC vs VIDEO)
  // ============================================================
  private async getAppointmentStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AppointmentStatsDto> {
    const result = await this.appointmentRepository
      .createQueryBuilder('a')
      .select([
        `COUNT(CASE WHEN a.appointmentType = '${AppointmentTypeEnum.IN_CLINIC}' THEN 1 END) as "inClinic"`,
        `COUNT(CASE WHEN a.appointmentType = '${AppointmentTypeEnum.VIDEO}' THEN 1 END) as "video"`,
      ])
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('a.status IN (:...statuses)', { statuses: VISITED_STATUSES })
      .getRawOne<AppointmentStatsRaw>();

    return {
      inClinic: Number(result?.inClinic) || 0,
      video: Number(result?.video) || 0,
    };
  }

  // ============================================================
  // PRIVATE: Thống kê bệnh nhân mới / cũ
  // ============================================================
  private async getPatientStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PatientStatsDto> {
    // BƯỚC 1: Ai đã đến khám trong kỳ
    const patientsInPeriod = await this.appointmentRepository
      .createQueryBuilder('a')
      .select('DISTINCT a.patientId', 'patientId')
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('a.status IN (:...statuses)', { statuses: VISITED_STATUSES })
      .getRawMany<PatientIdRaw>();

    if (!patientsInPeriod.length) {
      return { total: 0, new: 0, returning: 0 };
    }

    const patientIds = patientsInPeriod.map((p) => p.patientId);

    // BƯỚC 2: Ai trong số đó đã từng COMPLETED trước kỳ này?
    const returningIds = await this.getReturningPatientIds(
      doctorId,
      patientIds,
      startDate, // beforeDate = đầu kỳ
    );

    // BƯỚC 3: Tính
    const returning = patientIds.filter((id) => returningIds.has(id)).length;
    const newCount = patientIds.length - returning;

    return {
      total: patientIds.length,
      new: newCount,
      returning,
    };
  }

  private async getDailyBreakdown(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyBreakdownDto[]> {
    // Lấy TẤT CẢ appointment đã đến trong kỳ
    const rawAppointments = await this.appointmentRepository
      .createQueryBuilder('a')
      .select([
        "TO_CHAR(a.scheduledAt AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as date",
        'a.patientId as patientId',
      ])
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('a.status IN (:...statuses)', { statuses: VISITED_STATUSES })
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; patientid: string }>();

    const appointments: DailyAppointmentRaw[] = rawAppointments.map((r) => ({
      date: r.date,
      patientId: r.patientid,
    }));

    if (!appointments.length) return [];

    // Lấy tất cả patientId duy nhất trong kỳ
    const allPatientIds = [...new Set(appointments.map((a) => a.patientId))];

    // Ai trong số này đã từng COMPLETED trước kỳ? → returningIds
    const returningIds = await this.getReturningPatientIds(
      doctorId,
      allPatientIds,
      startDate,
    );

    // Gom nhóm theo ngày — đếm lượt
    const dailyMap = new Map<
      string,
      {
        newVisits: number;
        returningVisits: number;
      }
    >();

    for (const apt of appointments) {
      const { date, patientId } = apt;

      if (!dailyMap.has(date)) {
        dailyMap.set(date, { newVisits: 0, returningVisits: 0 });
      }

      const dayData = dailyMap.get(date)!;

      // Phân loại từng lượt:
      if (returningIds.has(patientId)) {
        dayData.returningVisits += 1;
      } else {
        dayData.newVisits += 1;
      }
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        newVisits: data.newVisits,
        returningVisits: data.returningVisits,
        totalVisits: data.newVisits + data.returningVisits,
        newPatients: data.newVisits,
        returningPatients: data.returningVisits,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // ============================================================
  // PRIVATE: Lấy số liệu kỳ trước để so sánh
  // ============================================================
  private async getPreviousPeriodStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const [revenue, appointments, patients] = await Promise.all([
      this.getRevenueStats(doctorId, startDate, endDate),
      this.getAppointmentStats(doctorId, startDate, endDate),
      this.getPatientStats(doctorId, startDate, endDate),
    ]);

    return {
      revenue: revenue.total,
      visitCount: revenue.visitCount,
      inClinic: appointments.inClinic,
      video: appointments.video,
      totalPatients: patients.total,
    };
  }

  // ============================================================
  // PRIVATE: Tính % thay đổi so với kỳ trước
  // ============================================================
  private calculateComparison(
    current: {
      revenue: RevenueStatsDto;
      appointments: AppointmentStatsDto;
      patients: PatientStatsDto;
    },
    previous: {
      revenue: number;
      visitCount: number;
      inClinic: number;
      video: number;
      totalPatients: number;
    },
  ): ComparisonStatsDto {
    const calcPercent = (curr: number, prev: number): number => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
    };

    return {
      previousPeriod: previous,
      percentChange: {
        revenue: calcPercent(current.revenue.total, previous.revenue),
        visitCount: calcPercent(
          current.revenue.visitCount,
          previous.visitCount,
        ),
        inClinic: calcPercent(current.appointments.inClinic, previous.inClinic),
        video: calcPercent(current.appointments.video, previous.video),
        totalPatients: calcPercent(
          current.patients.total,
          previous.totalPatients,
        ),
      },
    };
  }
}
