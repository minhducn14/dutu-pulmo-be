import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
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
}
