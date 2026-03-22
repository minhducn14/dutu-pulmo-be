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
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { ConsultationPricingService } from '@/modules/doctor/services/consultation-pricing.service';
import { RichTextService } from '@/modules/appointment/services/rich-text.service';
import { validateTextFieldsPolicy } from '@/common/utils/text-fields-policy.util';
import { NotificationService } from '@/modules/notification/notification.service';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';

@Injectable()
export class AppointmentCreateService {
  private readonly logger = new Logger(AppointmentCreateService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly dailyService: DailyService,
    private readonly mapper: AppointmentMapperService,
    private readonly pricingService: ConsultationPricingService,
    private readonly richTextService: RichTextService,
    private readonly notificationService: NotificationService,
  ) {}

  private generateAppointmentNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `APT-${timestamp}-${random}`;
  }

  async create(
    data: Partial<Appointment>,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    validateTextFieldsPolicy({
      chiefComplaint: data.chiefComplaint,
      chiefComplaintErrorCode:
        ERROR_MESSAGES.APPOINTMENT_NOTES_CHIEF_COMPLAINT_PLAIN_TEXT_ONLY,
    });

    if (data.patientNotes) {
      data.patientNotes = await this.richTextService.processPatientNotes(
        data.patientNotes,
      );
    }

    if (!data.timeSlotId || !data.patientId) {
      this.logger.error('Time slot ID or patient ID is missing');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const patient = await this.dataSource
      .getRepository('Patient')
      .findOne({ where: { id: data.patientId } });

    if (!patient) {
      this.logger.error('Patient not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
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
        this.logger.error('Time slot not found');
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      const schedule = slot.scheduleId
        ? await manager.findOne(DoctorSchedule, {
            where: { id: slot.scheduleId },
          })
        : null;

      if (!slot.isAvailable) {
        this.logger.error('Time slot is not available');
        throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
      }

      if (slot.bookedCount >= slot.capacity) {
        this.logger.error('Time slot is full');
        throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
      }

      if (isBeforeVN(slot.startTime, vnNow())) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      const existingAppointment = await manager
        .createQueryBuilder(Appointment, 'apt')
        .setLock('pessimistic_read')
        .innerJoin('apt.timeSlot', 'existingSlot')
        .where('apt.patientId = :patientId', { patientId: data.patientId })
        .andWhere('apt.status NOT IN (:...statuses)', {
          statuses: [AppointmentStatusEnum.CANCELLED],
        })
        .andWhere(
          '(existingSlot.startTime < :newEndTime AND existingSlot.endTime > :newStartTime)',
          {
            newEndTime: slot.endTime,
            newStartTime: slot.startTime,
          },
        )
        .getOne();

      console.log(existingAppointment);

      if (existingAppointment) {
        this.logger.error(
          'Patient has overlapping appointment conflicting with this time slot',
        );
        throw new ConflictException(ERROR_MESSAGES.CONFLICT_DETECTED);
      }

      if (!slot.allowedAppointmentTypes?.length) {
        this.logger.error('Time slot has no allowed appointment types');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      const appointmentType = slot.allowedAppointmentTypes[0];

      const doctor = await manager.findOne(Doctor, {
        where: { id: slot.doctorId },
      });

      let hospitalId = data.hospitalId;
      if (appointmentType === AppointmentTypeEnum.IN_CLINIC && !hospitalId) {
        hospitalId = doctor?.primaryHospitalId || undefined;
      }

      const baseFee = this.pricingService.resolveBaseFee(
        schedule?.consultationFee,
        doctor?.defaultConsultationFee,
      );
      const { finalFee } = this.pricingService.calculateFinalFee(
        baseFee,
        schedule?.discountPercent,
      );
      const feeAmount = this.pricingService.toVndString(finalFee);
      const isFree = finalFee === 0;

      const scheduledAt = slot.startTime;
      const durationMinutes = diffMinutes(slot.endTime, slot.startTime);

      if (durationMinutes <= 0) {
        this.logger.error('Duration minutes is less than or equal to 0');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
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

      // Thông báo cho Patient
      void this.notificationService.createNotification({
        userId: patient.userId,
        type: NotificationTypeEnum.APPOINTMENT,
        title: 'Đặt lịch thành công',
        content: `Lịch hẹn ${saved.appointmentNumber} đã được đặt thành công. Vui lòng thanh toán để xác nhận.`,
        refId: saved.id,
        refType: 'APPOINTMENT',
      });

      // Thông báo cho Doctor — cần query doctor.userId
      const doctorForNotification = await manager.findOne(Doctor, {
        where: { id: saved.doctorId },
        relations: ['user'],
      });
      if (doctorForNotification?.userId) {
        void this.notificationService.createNotification({
          userId: doctorForNotification.userId,
          type: NotificationTypeEnum.APPOINTMENT,
          title: 'Lịch hẹn mới',
          content: `Có lịch hẹn mới ${saved.appointmentNumber} được đặt vào ${saved.scheduledAt.toLocaleDateString('vi-VN')}.`,
          refId: saved.id,
          refType: 'APPOINTMENT',
        });
      }

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
