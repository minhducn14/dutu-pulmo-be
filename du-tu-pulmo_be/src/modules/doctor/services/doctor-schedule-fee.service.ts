import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';

@Injectable()
export class DoctorScheduleFeeService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
  ) {}

  async getEffectiveConsultationFee(
    schedule: DoctorSchedule,
  ): Promise<string | null> {
    let baseFee: string | null = null;

    if (schedule.consultationFee) {
      baseFee = schedule.consultationFee;
    } else {
      const doctor = await this.doctorRepository.findOne({
        where: { id: schedule.doctorId },
        select: ['id', 'defaultConsultationFee'],
      });
      baseFee = doctor?.defaultConsultationFee ?? null;
    }

    if (baseFee && schedule.discountPercent && schedule.discountPercent > 0) {
      const baseFeeNum = parseFloat(baseFee);
      const discountedFee = baseFeeNum * (1 - schedule.discountPercent / 100);
      return discountedFee.toFixed(2);
    }

    return baseFee;
  }

  async getConsultationFeeDetails(schedule: DoctorSchedule): Promise<{
    baseFee: string | null;
    discountPercent: number;
    finalFee: string | null;
  }> {
    let baseFee: string | null = null;

    if (schedule.consultationFee) {
      baseFee = schedule.consultationFee;
    } else {
      const doctor = await this.doctorRepository.findOne({
        where: { id: schedule.doctorId },
        select: ['id', 'defaultConsultationFee'],
      });
      baseFee = doctor?.defaultConsultationFee ?? null;
    }

    const discountPercent = schedule.discountPercent ?? 0;
    let finalFee = baseFee;

    if (baseFee && discountPercent > 0) {
      const baseFeeNum = parseFloat(baseFee);
      const discountedFee = baseFeeNum * (1 - discountPercent / 100);
      finalFee = discountedFee.toFixed(2);
    }

    return {
      baseFee,
      discountPercent,
      finalFee,
    };
  }

  async enrichScheduleWithEffectiveFee(schedule: DoctorSchedule): Promise<
    DoctorSchedule & {
      effectiveConsultationFee: string | null;
      finalFee: string | null;
      savedAmount: string | null;
      minimumBookingDays: number;
    }
  > {
    const baseFee = await this.getEffectiveConsultationFee(schedule);

    let finalFee: string | null = null;
    let savedAmount: string | null = null;

    let originalBaseFee: string | null = null;
    if (schedule.consultationFee) {
      originalBaseFee = schedule.consultationFee;
    } else {
      const doctor = await this.doctorRepository.findOne({
        where: { id: schedule.doctorId },
        select: ['id', 'defaultConsultationFee'],
      });
      originalBaseFee = doctor?.defaultConsultationFee ?? null;
    }

    const discountPercent = schedule.discountPercent ?? 0;

    if (originalBaseFee && discountPercent > 0) {
      const baseAmount = parseFloat(originalBaseFee);
      const discount = baseAmount * (discountPercent / 100);
      finalFee = (baseAmount - discount).toFixed(0);
      savedAmount = discount.toFixed(0);
    } else {
      finalFee = originalBaseFee;
    }

    const minimumBookingDays = Math.ceil(
      schedule.minimumBookingTime / (24 * 60),
    );

    return {
      ...schedule,
      effectiveConsultationFee: baseFee,
      finalFee,
      savedAmount,
      minimumBookingDays,
    };
  }

  async enrichSchedulesWithEffectiveFee(schedules: DoctorSchedule[]): Promise<
    (DoctorSchedule & {
      effectiveConsultationFee: string | null;
      finalFee: string | null;
      savedAmount: string | null;
      minimumBookingDays: number;
    })[]
  > {
    if (schedules.length === 0) return [];

    const doctorIds = [...new Set(schedules.map((s) => s.doctorId))];

    const doctors = await this.doctorRepository
      .createQueryBuilder('doctor')
      .select(['doctor.id', 'doctor.defaultConsultationFee'])
      .whereInIds(doctorIds)
      .getMany();

    const doctorFeeMap = new Map(
      doctors.map((d) => [d.id, d.defaultConsultationFee]),
    );

    return schedules.map((schedule) => {
      const baseFee =
        schedule.consultationFee ?? doctorFeeMap.get(schedule.doctorId) ?? null;
      const discountPercent = schedule.discountPercent ?? 0;

      let finalFee: string | null = null;
      let savedAmount: string | null = null;

      if (baseFee && discountPercent > 0) {
        const baseAmount = parseFloat(baseFee);
        const discount = baseAmount * (discountPercent / 100);
        finalFee = (baseAmount - discount).toFixed(0);
        savedAmount = discount.toFixed(0);
      } else {
        finalFee = baseFee;
      }

      const minimumBookingDays = Math.ceil(
        schedule.minimumBookingTime / (24 * 60),
      );

      return {
        ...schedule,
        effectiveConsultationFee: baseFee,
        finalFee,
        savedAmount,
        minimumBookingDays,
      };
    });
  }
}
