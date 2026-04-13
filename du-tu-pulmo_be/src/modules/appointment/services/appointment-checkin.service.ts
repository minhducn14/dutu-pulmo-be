import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
import { CHECKIN_TIME_THRESHOLDS } from '@/modules/appointment/appointment.constants';

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
    isLate: boolean = false,
  ): Promise<number> {
    const dayStart = startOfDayVN(scheduledAt);
    const dayEnd = endOfDayVN(scheduledAt);
    const queueLockKey = `appointment-queue:${doctorId}:${dayStart.toISOString()}`;

    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      queueLockKey,
    ]);

    const baseQuery = manager
      .createQueryBuilder(Appointment, 'apt')
      .select('MAX(apt.queueNumber)', 'maxQueue')
      .where('apt.doctorId = :doctorId', { doctorId })
      .andWhere('apt.scheduledAt BETWEEN :start AND :end', {
        start: dayStart,
        end: dayEnd,
      })
      .andWhere('apt.queueNumber IS NOT NULL');

    if (isLate) {
      const lateResult = await baseQuery
        .clone()
        .andWhere('apt.status IN (:...statuses)', {
          statuses: [
            AppointmentStatusEnum.CHECKED_IN,
            AppointmentStatusEnum.IN_PROGRESS,
          ],
        })
        .getRawOne<{ maxQueue: string | null }>();

      if (lateResult?.maxQueue != null) {
        return Number(lateResult.maxQueue) + 1;
      }
      // Fallback: tái dùng baseQuery
    }

    const result = await baseQuery.getRawOne<{ maxQueue: string | null }>();
    return Number(result?.maxQueue ?? 0) + 1;
  }

  async checkIn(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    const { queueNumber, doctorId, appointmentType, isLateCheckin } =
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

        // Validate thanh toán
        /*
        if (
          Number(appointmentStatus.paidAmount) <
          Number(appointmentStatus.feeAmount)
        ) {
          this.logger.error(
            `Appointment ${id} cannot check-in: Payment not completed. Paid: ${appointmentStatus.paidAmount}, Fee: ${appointmentStatus.feeAmount}`,
          );
          throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }
        */

        // Validate thời gian check-in
        const now = new Date();
        const timeDiffMinutes =
          (new Date(appointmentStatus.scheduledAt).getTime() - now.getTime()) /
          (1000 * 60);

        let isLateCheckin = false;
        const dayEnd = endOfDayVN(appointmentStatus.scheduledAt);
        if (now > dayEnd) {
          this.logger.error(`Appointment ${id} checked in after end of day.`);
          throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }

        if (
          appointmentStatus.appointmentType === AppointmentTypeEnum.IN_CLINIC
        ) {
          if (
            timeDiffMinutes > CHECKIN_TIME_THRESHOLDS.IN_CLINIC.EARLY_MINUTES
          ) {
            this.logger.error(
              `Appointment ${id} (IN_CLINIC) timeDiffMinutes is ${timeDiffMinutes}`,
            );
            throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
          }
          if (
            timeDiffMinutes < -CHECKIN_TIME_THRESHOLDS.IN_CLINIC.LATE_MINUTES
          ) {
            isLateCheckin = true;
          }
        } else if (
          appointmentStatus.appointmentType === AppointmentTypeEnum.VIDEO
        ) {
          if (
            timeDiffMinutes > CHECKIN_TIME_THRESHOLDS.VIDEO.EARLY_MINUTES ||
            timeDiffMinutes < -CHECKIN_TIME_THRESHOLDS.VIDEO.LATE_MINUTES
          ) {
            this.logger.error(
              `Appointment ${id} (VIDEO) timeDiffMinutes is ${timeDiffMinutes}`,
            );
            throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
          }
        }

        const newQueueNumber = await this.getNextQueueNumber(
          manager,
          appointmentStatus.doctorId,
          appointmentStatus.scheduledAt,
          isLateCheckin,
        );

        appointmentStatus.status = AppointmentStatusEnum.CHECKED_IN;
        appointmentStatus.checkInTime = new Date();
        appointmentStatus.queueNumber = newQueueNumber;
        appointmentStatus.isLateCheckin = isLateCheckin;
        await manager.save(appointmentStatus);

        return {
          queueNumber: newQueueNumber,
          doctorId: appointmentStatus.doctorId,
          appointmentType: appointmentStatus.appointmentType,
          isLateCheckin,
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
        title: 'Check-in thành công',
        content: isLateCheckin
          ? `Bạn đã check-in trễ lịch hẹn ${data.appointmentNumber}. Bạn được xếp cuối hàng chờ, số thứ tự: ${queueNumber}.`
          : `Bạn đã check-in lịch hẹn ${data.appointmentNumber}. Số thứ tự của bạn là: ${queueNumber}. Vui lòng chờ bác sĩ gọi tên.`,
        refId: id,
        refType: 'APPOINTMENT',
      });
    }

    // Notify doctor if late
    if (isLateCheckin && data.doctor?.userId) {
      void this.notificationService.createNotification({
        userId: data.doctor.userId,
        type: NotificationTypeEnum.APPOINTMENT,
        title: 'Bệnh nhân đến trễ',
        content: `Bệnh nhân ${data.patient?.user?.fullName || 'ẩn danh'} (Lịch hẹn ${data.appointmentNumber}) đã đến trễ và được xếp vào cuối hàng chờ. Số thứ tự: ${queueNumber}.`,
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

      record.chiefComplaint = dto.chiefComplaint;
      if (dto.physicalExamNotes)
        record.physicalExamNotes = dto.physicalExamNotes;
      record.assessment = dto.assessment;
      if (dto.diagnosis) record.diagnosis = dto.diagnosis;
      record.treatmentPlan = dto.treatmentPlan;
      if (dto.followUpInstructions)
        record.followUpInstructions = dto.followUpInstructions;
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
    void this.medicalService.generatePdfsForRecordWithRetry(result.recordId).catch((err) => {
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

}
