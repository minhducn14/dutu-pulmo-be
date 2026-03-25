import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  PreviewFlexibleScheduleConflictsDto,
  PreviewTimeOffConflictsDto,
  PreviewConflictsResponseDto,
  ConflictingAppointmentDto,
} from '@/modules/doctor/dto/preview-conflicts.dto';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import { endOfDayVN, startOfDayVN, vnNow } from '@/common/datetime';

@Injectable()
export class DoctorSchedulePreviewService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
    @InjectRepository(DoctorSchedule)
    private readonly doctorScheduleRepository: Repository<DoctorSchedule>,
  ) {}

  async previewFlexibleScheduleConflicts(
    doctorId: string,
    dto: PreviewFlexibleScheduleConflictsDto,
  ): Promise<ResponseCommon<PreviewConflictsResponseDto>> {
    const specificDate = new Date(dto.specificDate);

    const today = startOfDayVN(vnNow());
    if (specificDate < today) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    // safe base date
    const baseDate = startOfDayVN(specificDate);

    const scheduleStart = new Date(
      baseDate.getTime() + (startH * 60 + startM) * 60000,
    );
    const scheduleEnd = new Date(
      baseDate.getTime() + (endH * 60 + endM) * 60000,
    );

    const startOfDay = startOfDayVN(specificDate);
    const endOfDay = endOfDayVN(specificDate);

    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startOfDay, endOfDay),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ]),
      },
      relations: [
        'patient',
        'patient.user',
        'doctor',
        'doctor.user',
        'timeSlot',
        'timeSlot.schedule',
      ],
    });
    const timeOffPeriods = await this.getTimeOffPeriods(
      doctorId,
      startOfDay,
      endOfDay,
      specificDate,
    );

    const conflicting = appointments.filter((apt) => {
      if (!apt.timeSlot?.schedule?.slotDuration) return true;
      const aptEnd = new Date(
        apt.scheduledAt.getTime() +
          apt.timeSlot.schedule.slotDuration * 60 * 1000,
      );
      const fitsFlexibleWindow =
        apt.scheduledAt >= scheduleStart && aptEnd <= scheduleEnd;

      return (
        !fitsFlexibleWindow ||
        this.overlapsBlockingPeriod(apt.scheduledAt, aptEnd, timeOffPeriods)
      );
    });

    const affectedSlots = await this.countSlotsForDay(
      doctorId,
      startOfDay,
      endOfDay,
    );

    const conflictingAppointments: ConflictingAppointmentDto[] =
      conflicting.map((apt) => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        patientName: apt.patient?.user?.fullName || 'Unknown',
        scheduledAt: apt.scheduledAt,
        durationMinutes: apt.timeSlot?.schedule?.slotDuration ?? 30,
        status: apt.status,
        appointmentType: apt.appointmentType,
      }));

    const message =
      conflicting.length > 0
        ? `Sẽ có ${conflicting.length} lịch hẹn bị hủy và ${affectedSlots} time slots bị thay thế nếu tạo lịch này.`
        : `Không có lịch hẹn nào bị ảnh hưởng. ${affectedSlots} time slots sẽ bị thay thế.`;

    return new ResponseCommon(200, message, {
      conflictingAppointments,
      affectedSlotsCount: affectedSlots,
      message,
    });
  }

  async previewTimeOffConflicts(
    doctorId: string,
    dto: PreviewTimeOffConflictsDto,
  ): Promise<ResponseCommon<PreviewConflictsResponseDto>> {
    const specificDate = new Date(dto.specificDate);

    const today = startOfDayVN(vnNow());
    if (specificDate < today) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    const baseDate = startOfDayVN(specificDate);

    const scheduleStart = new Date(
      baseDate.getTime() + (startH * 60 + startM) * 60000,
    );
    const scheduleEnd = new Date(
      baseDate.getTime() + (endH * 60 + endM) * 60000,
    );

    const startOfDay = startOfDayVN(specificDate);
    const endOfDay = endOfDayVN(specificDate);

    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startOfDay, endOfDay),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ]),
      },
      relations: ['patient', 'patient.user', 'timeSlot', 'timeSlot.schedule'],
    });

    const conflicting = appointments.filter((apt) => {
      if (!apt.timeSlot?.schedule?.slotDuration) return false;
      const aptEnd = new Date(
        apt.scheduledAt.getTime() +
          apt.timeSlot.schedule.slotDuration * 60 * 1000,
      );
      return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
    });

    const affectedSlots = await this.countOverlappingSlots(
      doctorId,
      scheduleStart,
      scheduleEnd,
    );

    const conflictingAppointments: ConflictingAppointmentDto[] =
      conflicting.map((apt) => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        patientName: apt.patient?.user?.fullName || 'Unknown',
        scheduledAt: apt.scheduledAt,
        durationMinutes: apt.timeSlot.schedule.slotDuration,
        appointmentType: apt.appointmentType,
        status: apt.status,
      }));

    const message =
      conflicting.length > 0
        ? `Sẽ có ${conflicting.length} lịch hẹn bị hủy và ${affectedSlots} time slots bị tắt nếu tạo lịch nghỉ này.`
        : `Không có lịch hẹn nào bị ảnh hưởng. ${affectedSlots} time slots sẽ bị tắt.`;

    return new ResponseCommon(200, message, {
      conflictingAppointments,
      affectedSlotsCount: affectedSlots,
      message,
    });
  }

  async previewUpdateRegularConflicts(
    scheduleId: string,
    newStartTime: string,
    newEndTime: string,
  ): Promise<ResponseCommon<PreviewConflictsResponseDto>> {
    const schedule = await this.doctorScheduleRepository.findOne({
      where: { id: scheduleId },
    });
    if (!schedule || schedule.scheduleType !== ScheduleType.REGULAR) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    if (newStartTime >= newEndTime) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const [newStartH, newStartM] = newStartTime.split(':').map(Number);
    const [newEndH, newEndM] = newEndTime.split(':').map(Number);

    const futureAppointments = await this.appointmentRepository.find({
      where: {
        doctorId: schedule.doctorId,
        scheduledAt: Between(new Date(), new Date('2100-01-01')),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ]),
        timeSlot: {
          scheduleId: schedule.id,
        },
      },
      relations: ['timeSlot', 'timeSlot.schedule', 'patient', 'patient.user'],
    });

    const conflicting: Appointment[] = [];

    for (const apt of futureAppointments) {
      const aptDate = apt.scheduledAt;

      // Calculate start/end based on aptDate's VN Day
      const baseDate = startOfDayVN(aptDate);

      const newScheduleStart = new Date(
        baseDate.getTime() + (newStartH * 60 + newStartM) * 60000,
      );
      const newScheduleEnd = new Date(
        baseDate.getTime() + (newEndH * 60 + newEndM) * 60000,
      );

      if (!apt.timeSlot?.schedule?.slotDuration) continue;

      const aptEnd = new Date(
        apt.scheduledAt.getTime() +
          apt.timeSlot.schedule.slotDuration * 60 * 1000,
      );

      const fitsInNew =
        apt.scheduledAt >= newScheduleStart && aptEnd <= newScheduleEnd;

      if (!fitsInNew) {
        conflicting.push(apt);
      }
    }

    const conflictingAppointments: ConflictingAppointmentDto[] =
      conflicting.map((apt) => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        patientName: apt.patient?.user?.fullName || 'Unknown',
        scheduledAt: apt.scheduledAt,
        durationMinutes: apt.timeSlot?.schedule?.slotDuration ?? 30,
        appointmentType: apt.appointmentType,
        status: apt.status,
      }));

    const message = `Cập nhật lịch này sẽ ảnh hưởng đến ${conflicting.length} lịch hẹn hiện tại.`;

    return new ResponseCommon(200, message, {
      conflictingAppointments,
      affectedSlotsCount: 0,
      message,
    });
  }

  async previewDeleteRegularConflicts(
    scheduleId: string,
  ): Promise<ResponseCommon<PreviewConflictsResponseDto>> {
    const schedule = await this.doctorScheduleRepository.findOne({
      where: { id: scheduleId },
    });
    if (!schedule || schedule.scheduleType !== ScheduleType.REGULAR) {
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const futureAppointments = await this.appointmentRepository.find({
      where: {
        doctorId: schedule.doctorId,
        scheduledAt: Between(new Date(), new Date('2100-01-01')),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ]),
        timeSlot: {
          scheduleId: schedule.id,
        },
      },
      relations: ['timeSlot', 'timeSlot.schedule', 'patient', 'patient.user'],
    });

    const conflictingAppointments: ConflictingAppointmentDto[] =
      futureAppointments.map((apt) => ({
        id: apt.id,
        appointmentNumber: apt.appointmentNumber,
        patientName: apt.patient?.user?.fullName || 'Unknown',
        scheduledAt: apt.scheduledAt,
        durationMinutes: apt.timeSlot?.schedule?.slotDuration ?? 30,
        appointmentType: apt.appointmentType,
        status: apt.status,
      }));

    const message = `Xóa lịch này sẽ hủy ${futureAppointments.length} lịch hẹn trong tương lai.`;

    return new ResponseCommon(200, message, {
      conflictingAppointments,
      affectedSlotsCount: 0,
      message,
    });
  }

  private async countOverlappingSlots(
    doctorId: string,
    scheduleStart: Date,
    scheduleEnd: Date,
  ): Promise<number> {
    return this.timeSlotRepository
      .createQueryBuilder('slot')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.startTime < :scheduleEnd', { scheduleEnd })
      .andWhere('slot.endTime > :scheduleStart', { scheduleStart })
      .andWhere('slot.bookedCount = 0')
      .getCount();
  }

  private async countSlotsForDay(
    doctorId: string,
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<number> {
    return this.timeSlotRepository
      .createQueryBuilder('slot')
      .where('slot.doctorId = :doctorId', { doctorId })
      .andWhere('slot.startTime >= :startOfDay', { startOfDay })
      .andWhere('slot.startTime <= :endOfDay', { endOfDay })
      .andWhere('slot.bookedCount = 0')
      .getCount();
  }

  private async getTimeOffPeriods(
    doctorId: string,
    startOfDay: Date,
    endOfDay: Date,
    specificDate: Date,
  ): Promise<Array<{ start: Date; end: Date }>> {
    const timeOffSchedules = await this.doctorScheduleRepository.find({
      where: {
        doctorId,
        scheduleType: ScheduleType.TIME_OFF,
        specificDate: Between(startOfDay, endOfDay),
      },
    });

    const baseDate = startOfDayVN(specificDate);
    const periods = timeOffSchedules
      .map((schedule) => {
        const [startH, startM] = schedule.startTime.split(':').map(Number);
        const [endH, endM] = schedule.endTime.split(':').map(Number);

        return {
          start: new Date(baseDate.getTime() + (startH * 60 + startM) * 60000),
          end: new Date(baseDate.getTime() + (endH * 60 + endM) * 60000),
        };
      })
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const merged: Array<{ start: Date; end: Date }> = [];
    for (const period of periods) {
      const last = merged[merged.length - 1];
      if (!last || period.start > last.end) {
        merged.push(period);
        continue;
      }

      last.end = new Date(Math.max(last.end.getTime(), period.end.getTime()));
    }

    return merged;
  }

  private overlapsBlockingPeriod(
    slotStart: Date,
    slotEnd: Date,
    blockingPeriods: Array<{ start: Date; end: Date }>,
  ): boolean {
    return blockingPeriods.some(
      (period) => slotStart < period.end && slotEnd > period.start,
    );
  }
}
