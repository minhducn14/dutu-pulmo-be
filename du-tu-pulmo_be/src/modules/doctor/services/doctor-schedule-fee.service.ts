import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { ConsultationPricingService } from '@/modules/doctor/services/consultation-pricing.service';

@Injectable()
export class DoctorScheduleFeeService {
  constructor(
    @InjectRepository(Doctor)
    private readonly doctorRepository: Repository<Doctor>,
    private readonly pricingService: ConsultationPricingService,
  ) {}

  async getEffectiveConsultationFee(
    schedule: DoctorSchedule,
  ): Promise<string | null> {
    const { baseFee, finalFee } = await this.resolvePricing(schedule);
    if (baseFee === 0 && finalFee === 0) return null;
    return this.pricingService.toVndString(finalFee);
  }

  async getConsultationFeeDetails(schedule: DoctorSchedule): Promise<{
    baseFee: string | null;
    discountPercent: number;
    finalFee: string | null;
  }> {
    const { baseFee, discountPercent, finalFee } =
      await this.resolvePricing(schedule);

    return {
      baseFee: baseFee > 0 ? this.pricingService.toVndString(baseFee) : null,
      discountPercent,
      finalFee: finalFee > 0 ? this.pricingService.toVndString(finalFee) : null,
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
    const pricing = await this.resolvePricing(schedule);

    let finalFee: string | null = null;
    let savedAmount: string | null = null;
    if (pricing.baseFee > 0) {
      finalFee = this.pricingService.toVndString(pricing.finalFee);
      savedAmount = this.pricingService.toVndString(
        pricing.baseFee - pricing.finalFee,
      );
    }

    const minimumBookingDays = (schedule.minimumBookingTime ?? 0) / (24 * 60);

    return {
      ...schedule,
      effectiveConsultationFee:
        pricing.baseFee > 0
          ? this.pricingService.toVndString(pricing.baseFee)
          : null,
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
      const baseFee = this.pricingService.resolveBaseFee(
        schedule.consultationFee,
        doctorFeeMap.get(schedule.doctorId),
      );
      const pricing = this.pricingService.calculateFinalFee(
        baseFee,
        schedule.discountPercent,
      );
      const finalFee =
        pricing.finalFee > 0
          ? this.pricingService.toVndString(pricing.finalFee)
          : null;
      const savedAmount =
        pricing.baseFee > 0
          ? this.pricingService.toVndString(pricing.baseFee - pricing.finalFee)
          : null;

      const minimumBookingDays = (schedule.minimumBookingTime ?? 0) / (24 * 60);

      return {
        ...schedule,
        effectiveConsultationFee:
          pricing.baseFee > 0
            ? this.pricingService.toVndString(pricing.baseFee)
            : null,
        finalFee,
        savedAmount,
        minimumBookingDays,
      };
    });
  }

  private async resolvePricing(
    schedule: DoctorSchedule,
  ): Promise<{ baseFee: number; discountPercent: number; finalFee: number }> {
    let doctorDefaultFee: string | null = null;
    if (!schedule.consultationFee) {
      const doctor = await this.doctorRepository.findOne({
        where: { id: schedule.doctorId },
        select: ['id', 'defaultConsultationFee'],
      });
      doctorDefaultFee = doctor?.defaultConsultationFee ?? null;
    }

    const baseFee = this.pricingService.resolveBaseFee(
      schedule.consultationFee,
      doctorDefaultFee,
    );
    return this.pricingService.calculateFinalFee(
      baseFee,
      schedule.discountPercent,
    );
  }
}
