import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThanOrEqual, Not, Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import {
  AppointmentStatisticsDto,
  DoctorQueueDto,
} from '@/modules/appointment/dto/appointment-response.dto';
import {
  APPOINTMENT_BASE_RELATIONS,
  CHECKIN_TIME_THRESHOLDS,
} from '@/modules/appointment/appointment.constants';
import { AppointmentMapperService } from '@/modules/appointment/services/appointment-mapper.service';

@Injectable()
export class AppointmentStatsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly mapper: AppointmentMapperService,
  ) {}

  async getDoctorQueue(
    doctorId: string,
  ): Promise<ResponseCommon<DoctorQueueDto>> {
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startOfDay, endOfDay),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.CHECKED_IN,
          AppointmentStatusEnum.IN_PROGRESS,
        ]),
      },
      relations: APPOINTMENT_BASE_RELATIONS,
      order: {
        queueNumber: 'ASC',
      },
    });

    const inProgress = appointments.filter(
      (a) => a.status === AppointmentStatusEnum.IN_PROGRESS,
    );
    const checkedIn = appointments.filter(
      (a) => a.status === AppointmentStatusEnum.CHECKED_IN,
    );

    // Filter CONFIRMED: only show if still within late threshold
    // Overdue appointments can't check-in, so they shouldn't appear in queue
    const confirmed = appointments.filter((a) => {
      if (a.status !== AppointmentStatusEnum.CONFIRMED) return false;

      const scheduledTime = new Date(a.scheduledAt);
      const timeDiffMinutes =
        (scheduledTime.getTime() - now.getTime()) / (1000 * 60);

      const lateThreshold =
        a.appointmentType === 'VIDEO'
          ? CHECKIN_TIME_THRESHOLDS.VIDEO.LATE_MINUTES
          : CHECKIN_TIME_THRESHOLDS.IN_CLINIC.LATE_MINUTES;

      // timeDiffMinutes < 0 means past scheduled time
      // Allow if not too late (within threshold)
      return timeDiffMinutes >= -lateThreshold;
    });

    // Total in queue = active appointments only (excludes overdue CONFIRMED)
    const totalInQueue = inProgress.length + checkedIn.length + confirmed.length;
    let queueData: DoctorQueueDto;

    if (totalInQueue > 0) {
      const firstAppointment = inProgress[0] || checkedIn[0] || confirmed[0];
      queueData = {
        doctor: this.mapper.toDoctorDto(firstAppointment.doctor),
        patient: this.mapper.toPatientDto(firstAppointment.patient),
        totalInQueue,
        inProgress: inProgress.map((a) => this.mapper.toDto(a)),
        waitingQueue: checkedIn.map((a) => this.mapper.toDto(a)),
        upcomingToday: confirmed.map((a) => this.mapper.toDto(a)),
        currentPatient: inProgress[0] ? this.mapper.toDto(inProgress[0]) : null,
        nextPatient: checkedIn[0] ? this.mapper.toDto(checkedIn[0]) : null,
      };
    } else {
      queueData = {
        doctor: null,
        patient: null,
        totalInQueue: 0,
        inProgress: [],
        waitingQueue: [],
        upcomingToday: [],
        currentPatient: null,
        nextPatient: null,
      };
    }

    return new ResponseCommon(200, 'SUCCESS', queueData);
  }

  async getDoctorStatistics(
    doctorId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<ResponseCommon<AppointmentStatisticsDto>> {
    if (!startDate) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    if (!endDate) {
      endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);
    }

    const whereConditions = {
      doctorId,
      scheduledAt: Between(startDate, endDate),
    };

    const [
      total,
      completed,
      cancelled,
      pending,
      confirmed,
      inProgress,
      appointments,
    ] = await Promise.all([
      this.appointmentRepository.count({ where: whereConditions }),
      this.appointmentRepository.count({
        where: { ...whereConditions, status: AppointmentStatusEnum.COMPLETED },
      }),
      this.appointmentRepository.count({
        where: { ...whereConditions, status: AppointmentStatusEnum.CANCELLED },
      }),
      this.appointmentRepository.count({
        where: {
          ...whereConditions,
          status: In([
            AppointmentStatusEnum.PENDING,
            AppointmentStatusEnum.PENDING_PAYMENT,
          ]),
        },
      }),
      this.appointmentRepository.count({
        where: { ...whereConditions, status: AppointmentStatusEnum.CONFIRMED },
      }),
      this.appointmentRepository.count({
        where: {
          ...whereConditions,
          status: AppointmentStatusEnum.IN_PROGRESS,
        },
      }),
      this.appointmentRepository.find({
        where: {
          doctorId,
          scheduledAt: MoreThanOrEqual(new Date()),
          status: In([
            AppointmentStatusEnum.CONFIRMED,
            AppointmentStatusEnum.PENDING,
            AppointmentStatusEnum.PENDING_PAYMENT,
          ]),
        },
        relations: APPOINTMENT_BASE_RELATIONS,
        order: { scheduledAt: 'ASC' },
        take: 10,
      }),
    ]);

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const todayTotal = await this.appointmentRepository.count({
      where: {
        doctorId,
        scheduledAt: Between(startOfToday, endOfToday),
      },
    });

    const stats: AppointmentStatisticsDto = {
      totalAppointments: total,
      completedCount: completed,
      cancelledCount: cancelled,
      pendingCount: pending,
      confirmedCount: confirmed,
      inProgressCount: inProgress,
      upcomingCount: confirmed + pending,
      todayCount: todayTotal,
      upcomingAppointments: appointments.map((a) => this.mapper.toDto(a)),
    };

    return new ResponseCommon(200, 'SUCCESS', stats);
  }

  async getPatientStatistics(
    patientId: string,
  ): Promise<ResponseCommon<AppointmentStatisticsDto>> {
    const [total, completed, cancelled, upcoming, appointments] =
      await Promise.all([
        this.appointmentRepository.count({ where: { patientId } }),
        this.appointmentRepository.count({
          where: { patientId, status: AppointmentStatusEnum.COMPLETED },
        }),
        this.appointmentRepository.count({
          where: { patientId, status: AppointmentStatusEnum.CANCELLED },
        }),
        this.appointmentRepository.count({
          where: {
            patientId,
            scheduledAt: MoreThanOrEqual(new Date()),
            status: Not(
              In([
                AppointmentStatusEnum.CANCELLED,
                AppointmentStatusEnum.COMPLETED,
              ]),
            ),
          },
        }),
        this.appointmentRepository.find({
          where: {
            patientId,
            scheduledAt: MoreThanOrEqual(new Date()),
            status: Not(
              In([
                AppointmentStatusEnum.CANCELLED,
                AppointmentStatusEnum.COMPLETED,
              ]),
            ),
          },
          relations: APPOINTMENT_BASE_RELATIONS,
          order: { scheduledAt: 'ASC' },
          take: 10,
        }),
      ]);

    const stats: AppointmentStatisticsDto = {
      totalAppointments: total,
      completedCount: completed,
      cancelledCount: cancelled,
      upcomingCount: upcoming,
      upcomingAppointments: appointments.map((a) => this.mapper.toDto(a)),
    };

    return new ResponseCommon(200, 'SUCCESS', stats);
  }
}
