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

const PERIOD_DAYS = {
  LAST_7_DAYS: 7,
  LAST_30_DAYS: 30,
} as const;

interface PeriodDates {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
}

interface PatientFirstVisit {
  patientId: string;
  firstVisit: Date;
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

interface PatientFirstVisitRaw {
  patientId: string;
  firstVisit: string | Date;
}

interface DailyAppointmentRaw {
  date: string;
  patientId: string;
}

@Injectable()
export class DashboardStatsService {
  private readonly logger = new Logger(DashboardStatsService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

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
    const currentStart = startOfDayVN(now);
    const currentEnd = endOfDayVN(now);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    return {
      currentStart,
      currentEnd,
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
      .andWhere('p.paidAt BETWEEN :startDate AND :endDate', {
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

  private async getAppointmentStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AppointmentStatsDto> {
    const result = await this.appointmentRepository
      .createQueryBuilder('a')
      .select([
        `COUNT(CASE WHEN a.appointmentType = '${AppointmentTypeEnum.IN_CLINIC}' THEN 1 END) as inClinic`,
        `COUNT(CASE WHEN a.appointmentType = '${AppointmentTypeEnum.VIDEO}' THEN 1 END) as video`,
      ])
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('a.status = :status', {
        status: AppointmentStatusEnum.COMPLETED,
      })
      .getRawOne<AppointmentStatsRaw>();

    return {
      inClinic: Number(result?.inClinic) || 0,
      video: Number(result?.video) || 0,
    };
  }

  private async getPatientStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PatientStatsDto> {
    const patientsInPeriod = await this.appointmentRepository
      .createQueryBuilder('a')
      .select('DISTINCT a.patientId', 'patientId')
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('a.status = :status', {
        status: AppointmentStatusEnum.COMPLETED,
      })
      .getRawMany<PatientIdRaw>();

    if (patientsInPeriod.length === 0) {
      return { total: 0, new: 0, returning: 0 };
    }

    const patientIds = patientsInPeriod.map((p) => p.patientId);
    const firstVisits = await this.getPatientFirstVisits(doctorId, patientIds);

    const firstVisitMap = new Map(
      firstVisits.map((fv) => [fv.patientId, fv.firstVisit]),
    );

    let newCount = 0;
    let returningCount = 0;

    for (const patientId of patientIds) {
      const firstVisit = firstVisitMap.get(patientId);

      if (!firstVisit) {
        newCount++;
      } else if (firstVisit >= startDate && firstVisit <= endDate) {
        newCount++;
      } else {
        returningCount++;
      }
    }

    return {
      total: patientIds.length,
      new: newCount,
      returning: returningCount,
    };
  }

  private async getPatientFirstVisits(
    doctorId: string,
    patientIds: string[],
  ): Promise<PatientFirstVisit[]> {
    const results = await this.appointmentRepository
      .createQueryBuilder('a')
      .select([
        'a.patientId as patientId',
        'MIN(a.scheduledAt) as firstVisit',
      ])
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.status = :status', {
        status: AppointmentStatusEnum.COMPLETED,
      })
      .andWhere('a.patientId IN (:...patientIds)', { patientIds })
      .groupBy('a.patientId')
      .getRawMany<PatientFirstVisitRaw>();

    return results.map((r) => ({
      patientId: r.patientId,
      firstVisit: new Date(r.firstVisit),
    }));
  }

  private async getDailyBreakdown(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyBreakdownDto[]> {
    const appointments = await this.appointmentRepository
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
      .andWhere('a.status = :status', {
        status: AppointmentStatusEnum.COMPLETED,
      })
      .orderBy('date', 'ASC')
      .getRawMany<DailyAppointmentRaw>();

    if (appointments.length === 0) return [];

    const patientIds = [...new Set(appointments.map((a) => a.patientId))];
    const firstVisits = await this.getPatientFirstVisits(doctorId, patientIds);
    const firstVisitMap = new Map(
      firstVisits.map((fv) => [fv.patientId, fv.firstVisit]),
    );

    const dailyMap = new Map<
      string,
      {
        visits: number;
        newPatients: Set<string>;
        returningPatients: Set<string>;
      }
    >();

    for (const apt of appointments) {
      const date = apt.date;
      const patientId = apt.patientId;

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          visits: 0,
          newPatients: new Set(),
          returningPatients: new Set(),
        });
      }

      const dayData = dailyMap.get(date)!;
      dayData.visits++;

      const firstVisit = firstVisitMap.get(patientId);

      if (!firstVisit || formatDateVN(firstVisit) === date) {
        dayData.newPatients.add(patientId);
      } else {
        dayData.returningPatients.add(patientId);
      }
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        visits: data.visits,
        newPatients: data.newPatients.size,
        returningPatients: data.returningPatients.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

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
