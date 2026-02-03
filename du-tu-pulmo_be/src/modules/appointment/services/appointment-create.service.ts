import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In, Not } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { AppointmentSubTypeEnum } from '@/modules/common/enums/appointment-sub-type.enum';
import { SourceTypeEnum } from '@/modules/common/enums/source-type.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { DailyService } from '@/modules/video_call/daily.service';
import { AppointmentMapperService } from '@/modules/appointment/services/appointment-mapper.service';
import { diffMinutes, isBeforeVN, vnNow } from '@/common/datetime';

@Injectable()
export class AppointmentCreateService {
  private readonly logger = new Logger(AppointmentCreateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dailyService: DailyService,
    private readonly mapper: AppointmentMapperService,
  ) {}

  private getFee(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
  }

  private generateAppointmentNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `APT-${timestamp}-${random}`;
  }

  async create(
    data: Partial<Appointment>,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    if (!data.timeSlotId || !data.patientId) {
      throw new BadRequestException(
        'Missing required fields: timeSlotId, patientId',
      );
    }

    const patient = await this.dataSource
      .getRepository('Patient')
      .findOne({ where: { id: data.patientId } });
    
    if (!patient) {
      throw new NotFoundException('Bệnh nhân không tồn tại');
    }

    return this.dataSource.transaction(async (manager) => {
      const slot = await manager
        .createQueryBuilder(TimeSlot, 'slot')
        .setLock('pessimistic_write', undefined, ['slot'])
        .leftJoinAndSelect('slot.doctor', 'doctor')
        .leftJoinAndSelect('slot.schedule', 'schedule')
        .where('slot.id = :id', { id: data.timeSlotId })
        .getOne();

      if (!slot) {
        throw new NotFoundException('Time slot không tồn tại');
      }

      const schedule = slot.scheduleId
        ? await manager.findOne(DoctorSchedule, {
            where: { id: slot.scheduleId },
          })
        : null;

      if (!slot.isAvailable) {
        throw new ConflictException('Khung giờ không khả dụng');
      }

      if (slot.bookedCount >= slot.capacity) {
        throw new ConflictException('Khung giờ đã hết chỗ');
      }

      if (isBeforeVN(slot.startTime, vnNow())) {
        throw new BadRequestException('Không thể đặt lịch cho slot quá khứ');
      }

      const existingAppointment = await manager.findOne(Appointment, {
        where: {
          patientId: data.patientId,
          timeSlotId: data.timeSlotId,
          status: Not(In([AppointmentStatusEnum.CANCELLED])),
        },
        lock: { mode: 'pessimistic_read' },
      });

      if (existingAppointment) {
        throw new ConflictException('Bạn đã đặt lịch slot này rồi');
      }

      if (!slot.allowedAppointmentTypes?.length) {
        throw new BadRequestException(
          'Slot chưa được cấu hình appointment type',
        );
      }

      const appointmentType = slot.allowedAppointmentTypes[0];

      if (!slot.allowedAppointmentTypes.includes(appointmentType)) {
        throw new BadRequestException(
          `Slot không hỗ trợ ${appointmentType}. Chỉ hỗ trợ: ${slot.allowedAppointmentTypes.join(', ')}`,
        );
      }

      const doctor = await manager.findOne(Doctor, {
        where: { id: slot.doctorId },
      });

      let hospitalId = data.hospitalId;
      if (appointmentType === AppointmentTypeEnum.IN_CLINIC && !hospitalId) {
        hospitalId = doctor?.primaryHospitalId || undefined;
      }

      let baseFee = this.getFee(schedule?.consultationFee);
      if (baseFee === 0) {
        baseFee = this.getFee(doctor?.defaultConsultationFee);
      }

      const discountPercent = schedule?.discountPercent || 0;
      let finalFee = baseFee;

      if (discountPercent > 0 && baseFee > 0) {
        finalFee = baseFee * ((100 - discountPercent) / 100);
      }

      finalFee = Math.floor(finalFee);
      const feeAmount = String(finalFee);
      const isFree = finalFee === 0;

      const scheduledAt = slot.startTime;
      const durationMinutes = diffMinutes(slot.endTime, slot.startTime);

      if (durationMinutes <= 0) {
        throw new BadRequestException('Slot có thời gian không hợp lệ');
      }

      const appointment = manager.create(Appointment, {
        appointmentNumber: this.generateAppointmentNumber(),
        patientId: data.patientId,
        doctorId: slot.doctorId,
        hospitalId: hospitalId ?? slot.doctor.primaryHospitalId,
        timeSlotId: slot.id,
        scheduledAt,
        durationMinutes,
        timezone: slot.timezone || 'Asia/Ho_Chi_Minh',
        appointmentType,
        subType: data.subType || AppointmentSubTypeEnum.SCHEDULED,
        sourceType: data.sourceType || SourceTypeEnum.EXTERNAL,
        feeAmount,
        paidAmount: '0',
        status: isFree
          ? AppointmentStatusEnum.CONFIRMED
          : AppointmentStatusEnum.PENDING_PAYMENT,
        chiefComplaint: data.chiefComplaint,
        symptoms: data.symptoms,
        patientNotes: data.patientNotes,
        bookedByUserId: data.bookedByUserId,
      });

      const saved = await manager.save(appointment);

      await manager.increment(TimeSlot, { id: slot.id }, 'bookedCount', 1);

      if (slot.bookedCount + 1 >= slot.capacity) {
        await manager.update(TimeSlot, { id: slot.id }, { isAvailable: false });
      }

      if (isFree && appointmentType === AppointmentTypeEnum.VIDEO) {
        try {
          const room = await this.dailyService.getOrCreateRoom(saved.id);
          saved.meetingUrl = room.url;
          saved.dailyCoChannel = room.name;
          await manager.save(saved);
          this.logger.log(
            `Auto-generated meeting URL for free appointment ${saved.id}`,
          );
        } catch (error) {
          this.logger.error(`Failed to generate meeting URL: ${error}`);
        }
      }

      return new ResponseCommon(
        201,
        'Tạo lịch hẹn thành công',
        this.mapper.toDto(saved),
      );
    });
  }
}
