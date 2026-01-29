import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { ResponseCommon } from '@/common/dto/response.dto';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';

@Injectable()
export class DoctorScheduleQueryService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly dataSource: DataSource,
  ) {}

  async findByDoctorId(
    doctorId: string,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const schedules = await this.scheduleRepository.find({
      where: { doctorId },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', schedules);
  }

  async findByDoctorIdAndType(
    doctorId: string,
    scheduleType: ScheduleType,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const schedules = await this.scheduleRepository.find({
      where: { doctorId, scheduleType },
      order: { dayOfWeek: 'ASC', startTime: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', schedules);
  }

  async findById(id: string): Promise<ResponseCommon<DoctorSchedule>> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
    });
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch với ID ${id}`);
    }
    return new ResponseCommon(200, 'SUCCESS', schedule);
  }

  async findByIdWithTimeSlots(
    id: string,
  ): Promise<ResponseCommon<DoctorSchedule>> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id },
      relations: ['timeSlots'],
    });
    if (!schedule) {
      throw new NotFoundException(`Không tìm thấy lịch với ID ${id}`);
    }
    return new ResponseCommon(200, 'SUCCESS', schedule);
  }

  async validateDoctorOwnership(
    scheduleId: string,
    doctorId: string,
  ): Promise<DoctorSchedule> {
    const result = await this.findById(scheduleId);
    const schedule = result.data!;

    if (schedule.doctorId !== doctorId) {
      throw new ForbiddenException('Bạn không có quyền thao tác với lịch này');
    }

    return schedule;
  }

  async getAppointmentsByScheduleVersion(
    scheduleId: string,
    version: number,
  ): Promise<Appointment[]> {
    return this.appointmentRepository
      .createQueryBuilder('apt')
      .innerJoin('apt.timeSlot', 'slot')
      .leftJoinAndSelect('apt.patient', 'patient')
      .leftJoinAndSelect('patient.user', 'user')
      .where('slot.scheduleId = :scheduleId', { scheduleId })
      .andWhere('slot.scheduleVersion = :version', { version })
      .andWhere('apt.status IN (:...statuses)', {
        statuses: [
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
          AppointmentStatusEnum.PENDING,
        ],
      })
      .orderBy('apt.scheduledAt', 'ASC')
      .getMany();
  }

  async getScheduleVersionHistory(scheduleId: string): Promise<
    {
      version: number;
      appointmentCount: number;
      activeCount: number;
      cancelledCount: number;
    }[]
  > {
    const result = await this.dataSource.manager
      .createQueryBuilder()
      .select('slot.scheduleVersion', 'version')
      .addSelect('COUNT(apt.id)', 'appointmentCount')
      .addSelect(
        `SUM(CASE WHEN apt.status NOT IN ('CANCELLED') THEN 1 ELSE 0 END)`,
        'activeCount',
      )
      .addSelect(
        `SUM(CASE WHEN apt.status = 'CANCELLED' THEN 1 ELSE 0 END)`,
        'cancelledCount',
      )
      .from(TimeSlot, 'slot')
      .leftJoin(Appointment, 'apt', 'apt.timeSlotId = slot.id')
      .where('slot.scheduleId = :scheduleId', { scheduleId })
      .andWhere('slot.scheduleVersion IS NOT NULL')
      .groupBy('slot.scheduleVersion')
      .orderBy('slot.scheduleVersion', 'DESC')
      .getRawMany<{
        version: string | number | null;
        appointmentCount: string | number | null;
        activeCount: string | number | null;
        cancelledCount: string | number | null;
      }>();

    return result.map((r) => ({
      version: Number.parseInt(String(r.version), 10),
      appointmentCount: Number.parseInt(String(r.appointmentCount), 10) || 0,
      activeCount: Number.parseInt(String(r.activeCount), 10) || 0,
      cancelledCount: Number.parseInt(String(r.cancelledCount), 10) || 0,
    }));
  }

  async findAvailableByDoctor(
    doctorId: string,
    dayOfWeek?: number,
  ): Promise<ResponseCommon<DoctorSchedule[]>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lookAheadDate = new Date();
    lookAheadDate.setDate(lookAheadDate.getDate() + 7);
    lookAheadDate.setHours(23, 59, 59, 999);

    const queryBuilder = this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.doctorId = :doctorId', { doctorId })
      .andWhere('schedule.isAvailable = :isAvailable', { isAvailable: true })
      .andWhere(
        '(schedule.effectiveFrom IS NULL OR schedule.effectiveFrom <= :lookAheadDate)',
        { lookAheadDate },
      )
      .andWhere(
        '(schedule.effectiveUntil IS NULL OR schedule.effectiveUntil >= :today)',
        { today },
      );

    if (dayOfWeek !== undefined) {
      queryBuilder.andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek });
    }

    const schedules = await queryBuilder
      .orderBy('schedule.dayOfWeek', 'ASC')
      .addOrderBy('schedule.startTime', 'ASC')
      .getMany();

    return new ResponseCommon(200, 'SUCCESS', schedules);
  }
}
