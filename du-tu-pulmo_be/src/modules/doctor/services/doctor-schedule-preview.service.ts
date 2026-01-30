import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { ScheduleType } from '@/modules/common/enums/schedule-type.enum';
import {
  PreviewFlexibleScheduleConflictsDto,
  PreviewTimeOffConflictsDto,
  PreviewConflictsResponseDto,
  ConflictingAppointmentDto,
} from '@/modules/doctor/dto/preview-conflicts.dto';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from '@/common/dto/response.dto';

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (specificDate < today) {
      throw new BadRequestException(
        'Không thể xem trước cho ngày trong quá khứ',
      );
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    const startOfDay = new Date(specificDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(specificDate);
    endOfDay.setHours(23, 59, 59, 999);

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

    const conflicting = appointments.filter((apt) => {
      if (!apt.timeSlot?.schedule?.slotDuration) return false;
      const aptEnd = new Date(
        apt.scheduledAt.getTime() +
          apt.timeSlot.schedule.slotDuration * 60 * 1000,
      );
      return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
    });

    const affectedSlots = await this.timeSlotRepository.count({
      where: {
        doctorId,
        startTime: Between(scheduleStart, scheduleEnd),
        isAvailable: true,
      },
    });

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (specificDate < today) {
      throw new BadRequestException(
        'Không thể xem trước cho ngày trong quá khứ',
      );
    }

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Giờ bắt đầu phải trước giờ kết thúc');
    }

    const [startH, startM] = dto.startTime.split(':').map(Number);
    const [endH, endM] = dto.endTime.split(':').map(Number);

    const scheduleStart = new Date(specificDate);
    scheduleStart.setHours(startH, startM, 0, 0);

    const scheduleEnd = new Date(specificDate);
    scheduleEnd.setHours(endH, endM, 0, 0);

    const startOfDay = new Date(specificDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(specificDate);
    endOfDay.setHours(23, 59, 59, 999);

    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startOfDay, endOfDay),
        status: In([
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.PENDING_PAYMENT,
        ]),
      },
      relations: ['patient', 'patient.user'],
    });

    const conflicting = appointments.filter((apt) => {
      const aptEnd = new Date(
        apt.scheduledAt.getTime() +
          apt.timeSlot.schedule.slotDuration * 60 * 1000,
      );
      return apt.scheduledAt < scheduleEnd && aptEnd > scheduleStart;
    });

    const affectedSlots = await this.timeSlotRepository.count({
      where: {
        doctorId,
        startTime: Between(scheduleStart, scheduleEnd),
        bookedCount: 0,
      },
    });

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
      throw new BadRequestException('Schedule not found or not REGULAR');
    }

    if (newStartTime >= newEndTime) {
      throw new BadRequestException('Start time must be before end time');
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

      const newScheduleStart = new Date(aptDate);
      newScheduleStart.setHours(newStartH, newStartM, 0, 0);

      const newScheduleEnd = new Date(aptDate);
      newScheduleEnd.setHours(newEndH, newEndM, 0, 0);

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
      throw new BadRequestException('Schedule not found or not REGULAR');
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
}
