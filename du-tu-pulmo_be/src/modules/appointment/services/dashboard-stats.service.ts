import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { Payment, PaymentStatus } from '@/modules/payment/entities/payment.entity';
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
} from '@/common/datetime';

interface PeriodDates {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
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
    const dates = this.calculatePeriodDates(period);

    const [revenue, appointments, patients, dailyBreakdown, prevStats] =
      await Promise.all([
        this.getRevenueStats(doctorId, dates.currentStart, dates.currentEnd),
        this.getAppointmentStats(doctorId, dates.currentStart, dates.currentEnd),
        this.getPatientStats(doctorId, dates.currentStart, dates.currentEnd),
        this.getDailyBreakdown(doctorId, dates.currentStart, dates.currentEnd),
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
  }

  private calculatePeriodDates(period: DashboardPeriodEnum): PeriodDates {
    const now = vnNow();
    let currentStart: Date;
    let currentEnd: Date;
    let prevStart: Date;
    let prevEnd: Date;

    switch (period) {
      case DashboardPeriodEnum.TODAY:
        currentStart = startOfDayVN(now);
        currentEnd = endOfDayVN(now);
        // Previous = yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        prevStart = startOfDayVN(yesterday);
        prevEnd = endOfDayVN(yesterday);
        break;

      case DashboardPeriodEnum.LAST_7_DAYS:
        currentEnd = endOfDayVN(now);
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 6);
        currentStart = startOfDayVN(currentStart);
        // Previous = 7 days before that
        prevEnd = new Date(currentStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
        prevEnd = endOfDayVN(prevEnd);
        prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - 6);
        prevStart = startOfDayVN(prevStart);
        break;

      case DashboardPeriodEnum.LAST_30_DAYS:
        currentEnd = endOfDayVN(now);
        currentStart = new Date(now);
        currentStart.setDate(currentStart.getDate() - 29);
        currentStart = startOfDayVN(currentStart);
        // Previous = 30 days before that
        prevEnd = new Date(currentStart);
        prevEnd.setDate(prevEnd.getDate() - 1);
        prevEnd = endOfDayVN(prevEnd);
        prevStart = new Date(prevEnd);
        prevStart.setDate(prevStart.getDate() - 29);
        prevStart = startOfDayVN(prevStart);
        break;

      default:
        currentStart = startOfDayVN(now);
        currentEnd = endOfDayVN(now);
        prevStart = startOfDayVN(now);
        prevEnd = endOfDayVN(now);
    }

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
        'COALESCE(SUM(CAST(p.amount AS BIGINT)), 0) as total',
        'COUNT(p.id) as visitCount',
      ])
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('p.status = :status', { status: PaymentStatus.PAID })
      .andWhere('p.paidAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    const prescriptions = await this.paymentRepository.count({
      where: {
        status: PaymentStatus.PAID,
        paidAt: Between(startDate, endDate),
      },
    });

    return {
      total: parseInt(result?.total || '0', 10),
      visitCount: parseInt(result?.visitCount || '0', 10),
      prescriptions: 0, 
      labTests: 0, 
    };
  }

  private async getAppointmentStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<AppointmentStatsDto> {
    const [inClinic, video] = await Promise.all([
      this.appointmentRepository.count({
        where: {
          doctorId,
          scheduledAt: Between(startDate, endDate),
          status: AppointmentStatusEnum.COMPLETED,
          appointmentType: AppointmentTypeEnum.IN_CLINIC,
        },
      }),
      this.appointmentRepository.count({
        where: {
          doctorId,
          scheduledAt: Between(startDate, endDate),
          status: AppointmentStatusEnum.COMPLETED,
          appointmentType: AppointmentTypeEnum.VIDEO,
        },
      }),
    ]);

    return { inClinic, video };
  }

  private async getPatientStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PatientStatsDto> {
    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startDate, endDate),
        status: AppointmentStatusEnum.COMPLETED,
      },
      select: ['patientId', 'scheduledAt'],
    });

    if (appointments.length === 0) {
      return { total: 0, new: 0, returning: 0 };
    }

    const patientIds = [...new Set(appointments.map((a) => a.patientId))];

    const newPatientIds: string[] = [];
    const returningPatientIds: string[] = [];

    for (const patientId of patientIds) {
      const previousAppointment = await this.appointmentRepository.findOne({
        where: {
          doctorId,
          patientId,
          status: AppointmentStatusEnum.COMPLETED,
        },
        order: { scheduledAt: 'ASC' },
        select: ['scheduledAt'],
      });

      if (previousAppointment && previousAppointment.scheduledAt < startDate) {
        returningPatientIds.push(patientId);
      } else {
        newPatientIds.push(patientId);
      }
    }

    return {
      total: patientIds.length,
      new: newPatientIds.length,
      returning: returningPatientIds.length,
    };
  }

  private async getDailyBreakdown(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DailyBreakdownDto[]> {
    const result = await this.appointmentRepository
      .createQueryBuilder('a')
      .select([
        "TO_CHAR(a.scheduledAt AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') as date",
        'COUNT(a.id) as visits',
      ])
      .where('a.doctorId = :doctorId', { doctorId })
      .andWhere('a.scheduledAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('a.status = :status', { status: AppointmentStatusEnum.COMPLETED })
      .groupBy("TO_CHAR(a.scheduledAt AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')")
      .orderBy('date', 'ASC')
      .getRawMany();

    return result.map((row) => ({
      date: row.date,
      visits: parseInt(row.visits, 10),
      newPatients: 0, 
      returningPatients: 0, 
    }));
  }

  private async getPreviousPeriodStats(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    revenue: number;
    visitCount: number;
    inClinic: number;
    video: number;
    totalPatients: number;
  }> {
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
        visitCount: calcPercent(current.revenue.visitCount, previous.visitCount),
        inClinic: calcPercent(current.appointments.inClinic, previous.inClinic),
        video: calcPercent(current.appointments.video, previous.video),
        totalPatients: calcPercent(current.patients.total, previous.totalPatients),
      },
    };
  }
}
