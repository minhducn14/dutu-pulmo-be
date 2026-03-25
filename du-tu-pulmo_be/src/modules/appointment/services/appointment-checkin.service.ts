import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Between, EntityManager, Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { MedicalService } from '@/modules/medical/medical.service';
import { MedicalRecord } from '@/modules/medical/entities/medical-record.entity';
import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { AppointmentReadService } from '@/modules/appointment/services/appointment-read.service';
import { AppointmentEntityService } from '@/modules/appointment/services/appointment-entity.service';
import { CompleteExaminationDto } from '@/modules/appointment/dto/complete-examination.dto';
import { endOfDayVN, startOfDayVN, vnNow } from '@/common/datetime';
import { MedicalRecordStatusEnum } from '@/modules/common/enums/medical-record-status.enum';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';
import { NotificationService } from '@/modules/notification/notification.service';
import { PdfService } from '@/modules/pdf/pdf.service';

@Injectable()
export class AppointmentCheckinService {
  private readonly logger = new Logger(AppointmentCheckinService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly dataSource: DataSource,
    private readonly medicalService: MedicalService,
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
    private readonly appointmentReadService: AppointmentReadService,
    private readonly appointmentEntityService: AppointmentEntityService,
    private readonly notificationService: NotificationService,
    private readonly pdfService: PdfService,
  ) {}

  private async getNextQueueNumber(
    manager: EntityManager,
    doctorId: string,
    scheduledAt: Date,
  ): Promise<number> {
    const dayStart = startOfDayVN(scheduledAt);
    const dayEnd = endOfDayVN(scheduledAt);
    const queueLockKey = `appointment-queue:${doctorId}:${dayStart.toISOString()}`;

    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      queueLockKey,
    ]);

    const maxQueueResult = await manager
      .createQueryBuilder(Appointment, 'apt')
      .select('MAX(apt.queueNumber)', 'maxQueue')
      .where('apt.doctorId = :doctorId', { doctorId })
      .andWhere('apt.scheduledAt BETWEEN :start AND :end', {
        start: dayStart,
        end: dayEnd,
      })
      .andWhere('apt.queueNumber IS NOT NULL')
      .getRawOne<{ maxQueue: string | null }>();

    return Number(maxQueueResult?.maxQueue ?? 0) + 1;
  }

  async checkIn(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    const { queueNumber, doctorId, appointmentType } =
      await this.dataSource.transaction(async (manager) => {
        // Lock appointment row trước
        const appointmentStatus = await manager.findOne(Appointment, {
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });

        if (!appointmentStatus) {
          throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
        }

        if (appointmentStatus.status !== AppointmentStatusEnum.CONFIRMED) {
          throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }

        // Validate thời gian check-in
        const now = new Date();
        const timeDiffMinutes =
          (new Date(appointmentStatus.scheduledAt).getTime() - now.getTime()) /
          (1000 * 60);

        if (
          appointmentStatus.appointmentType === AppointmentTypeEnum.IN_CLINIC
        ) {
          if (timeDiffMinutes > 30 || timeDiffMinutes < -15)
            throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        } else if (
          appointmentStatus.appointmentType === AppointmentTypeEnum.VIDEO
        ) {
          if (timeDiffMinutes > 60 || timeDiffMinutes < -30)
            throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }

        const newQueueNumber = await this.getNextQueueNumber(
          manager,
          appointmentStatus.doctorId,
          appointmentStatus.scheduledAt,
        );

        appointmentStatus.status = AppointmentStatusEnum.CHECKED_IN;
        appointmentStatus.checkInTime = new Date();
        appointmentStatus.queueNumber = newQueueNumber;
        await manager.save(appointmentStatus);

        return {
          queueNumber: newQueueNumber,
          doctorId: appointmentStatus.doctorId,
          appointmentType: appointmentStatus.appointmentType,
        };
      });

    this.logger.log(`Appointment ${id} checked in, queue #${queueNumber}`);

    const appt = await this.appointmentReadService.findById(id);
    const data = appt.data!;

    // Notify patient
    if (data.patient?.user?.id) {
      void this.notificationService.createNotification({
        userId: data.patient.user.id,
        type: NotificationTypeEnum.APPOINTMENT,
        title: 'Check-in',
        content: `Bạn đã check-in lịch hẹn ${data.appointmentNumber}. Số thứ tự: ${queueNumber}. Vui lòng chờ được gọi.`,
        refId: id,
        refType: 'APPOINTMENT',
      });
    }

    return appt;
  }

  /**
   * Check-in by appointmentNumber (for QR code scanning)
   */
  async checkInByNumber(
    appointmentNumber: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.appointmentRepository.findOne({
      where: { appointmentNumber },
    });

    if (!appointment) {
      this.logger.error('Appointment not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    // Validate appointment type for check-in by number
    if (appointment.appointmentType !== AppointmentTypeEnum.IN_CLINIC) {
      this.logger.error(
        `Appointment ${appointment.id} is not IN_CLINIC type, cannot check-in by number.`,
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    return this.checkIn(appointment.id);
  }

  async checkInVideo(
    id: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    await this.dataSource.transaction(async (manager) => {
      // Dùng pessimistic_write để lock appointment, tránh race condition số thứ tự
      const appointment = await manager.findOne(Appointment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        relations: ['timeSlot'],
      });

      if (!appointment) {
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      if (appointment.status !== AppointmentStatusEnum.CONFIRMED) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      if (appointment.appointmentType !== AppointmentTypeEnum.VIDEO) {
        this.logger.error('Appointment is not video');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      const now = new Date();
      const scheduledTime = new Date(appointment.scheduledAt);
      const timeDiffMinutes =
        (scheduledTime.getTime() - now.getTime()) / (1000 * 60);

      if (timeDiffMinutes > 60) {
        this.logger.error('Appointment is too early in video');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      if (timeDiffMinutes < -30) {
        this.logger.error('Appointment is too late in video');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      const newQueueNumber = await this.getNextQueueNumber(
        manager,
        appointment.doctorId,
        appointment.scheduledAt,
      );

      appointment.status = AppointmentStatusEnum.CHECKED_IN;
      appointment.checkInTime = new Date();
      appointment.queueNumber = newQueueNumber;

      await manager.save(appointment);

      this.logger.log(
        `VIDEO appointment ${id} checked in, queue #${newQueueNumber}`,
      );
    });

    return this.appointmentReadService.findById(id);
  }

  async startExamination(
    id: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    let createdEncounter: Pick<
      Awaited<ReturnType<MedicalService['upsertEncounterInTx']>>['record'],
      'id' | 'patientId' | 'recordNumber'
    > | null = null;

    await this.dataSource.transaction(async (manager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!appointment) {
        this.logger.error('Appointment not found');
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      if (appointment.status !== AppointmentStatusEnum.CHECKED_IN) {
        this.logger.error('Appointment is not checked in');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      appointment.status = AppointmentStatusEnum.IN_PROGRESS;
      appointment.startedAt = new Date();
      await manager.save(appointment);

      const encounterResult = await this.medicalService.upsertEncounterInTx(
        manager,
        appointment,
      );
      if (encounterResult.created) {
        createdEncounter = encounterResult.record;
      }
    });

    if (createdEncounter) {
      this.medicalService.logAutoCreatedEncounter(createdEncounter);
    }

    const appt = await this.appointmentReadService.findById(id);
    const data = appt.data!;

    if (data.patient?.user?.id) {
      void this.notificationService.createNotification({
        userId: data.patient.user.id,
        type: NotificationTypeEnum.APPOINTMENT,
        title: 'Bác sĩ đang khám',
        content: `Bác sĩ ${data.doctor?.fullName || ''} đã bắt đầu khám lịch hẹn ${data.appointmentNumber}.`,
        refId: id,
        refType: 'APPOINTMENT',
      });
    }

    return appt;
  }

  async completeExamination(
    id: string,
    dto: CompleteExaminationDto,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const result = await this.dataSource.transaction(async (manager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!appointment) {
        this.logger.error('Appointment not found');
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      if (appointment.status !== AppointmentStatusEnum.IN_PROGRESS) {
        this.logger.error('Appointment is not in progress');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      const record = await manager.findOne(MedicalRecord, {
        where: { appointmentId: id },
      });

      if (!record) {
        this.logger.error('Medical record not found');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      if (dto.physicalExamNotes)
        record.physicalExamNotes = dto.physicalExamNotes;
      if (dto.assessment) record.assessment = dto.assessment;
      if (dto.diagnosis) record.diagnosis = dto.diagnosis;
      if (dto.treatmentPlan) record.treatmentPlan = dto.treatmentPlan;
      await manager.save(record);

      appointment.status = AppointmentStatusEnum.COMPLETED;
      appointment.endedAt = new Date();
      appointment.followUpRequired = dto.followUpRequired || false;
      if (dto.nextAppointmentDate) {
        appointment.nextAppointmentDate = new Date(dto.nextAppointmentDate);
      }
      await manager.save(appointment);

      this.logger.log(`Examination completed for appointment ${id}`);

      record.status = MedicalRecordStatusEnum.IN_PROGRESS;
      await manager.save(record);

      return { appointment, recordId: record.id };
    });

    if (
      result.appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
      result.appointment.dailyCoChannel
    ) {
      try {
        await this.dailyService.deleteRoom(result.appointment.dailyCoChannel);
        await this.callStateService.clearCallsForAppointment(
          result.appointment.id,
        );
        this.logger.log(
          `Cleaned up video room for completed appointment ${result.appointment.id}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup video room for ${result.appointment.id}: ${error}`,
        );
      }
    }

    // Gửi ngầm việc generate PDF, không block response
    void this.generatePdfWithRetry(result.recordId).catch((err) => {
      this.logger.error(
        `Final PDF generation failed after retries for record ${result.recordId}: ${err.message}`,
      );
    });

    const appt = await this.appointmentReadService.findById(id);
    const data = appt.data!;

    if (data.patient?.user?.id) {
      void this.notificationService.createNotification({
        userId: data.patient.user.id,
        type: NotificationTypeEnum.APPOINTMENT,
        title: 'Khám hoàn tất',
        content: `Lịch hẹn ${data.appointmentNumber} đã hoàn thành. Bác sĩ đã ghi kết quả khám.`,
        refId: id,
        refType: 'APPOINTMENT',
      });
    }

    return appt;
  }

  private async generatePdfWithRetry(
    recordId: string,
    retries = 3,
    delay = 1000, // 1 second
  ): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        this.logger.log(
          `Attempt ${i + 1} to generate PDFs for record ${recordId}`,
        );

        // 1. Medical record PDF
        await this.pdfService.generateAndSaveMedicalRecordPdf(recordId);

        // 2. Prescription PDFs
        const record = await this.medicalService.findById(recordId);

        for (const p of record.prescriptions ?? []) {
          await this.pdfService.generateAndSavePrescriptionPdf(p.id);
        }

        this.logger.log(`Successfully generated PDFs for record ${recordId}`);
        return;
      } catch (error: any) {
        const isLastRetry = i === retries - 1;
        this.logger.warn(
          `PDF generation attempt ${i + 1} failed for ${recordId}: ${error.message}. ` +
            (isLastRetry ? 'Giving up.' : `Retrying in ${delay}ms...`),
        );
        if (isLastRetry) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
  }
}
