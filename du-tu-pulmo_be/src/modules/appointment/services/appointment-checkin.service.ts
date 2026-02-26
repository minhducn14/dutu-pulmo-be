import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Between, Repository } from 'typeorm';
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
  ) {}

  async checkIn(id: string): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.appointmentEntityService.findOne(id);

    if (!appointment) {
      this.logger.error('Appointment not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    if (appointment.status !== AppointmentStatusEnum.CONFIRMED) {
      this.logger.error('Appointment is not confirmed');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const now = new Date();
    const scheduledTime = new Date(appointment.scheduledAt);
    const timeDiffMinutes =
      (scheduledTime.getTime() - now.getTime()) / (1000 * 60);

    if (appointment.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (timeDiffMinutes > 30) {
        this.logger.error('Appointment is too early in clinic');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      if (timeDiffMinutes < -15) {
        this.logger.error('Appointment is too late in clinic');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    } else if (appointment.appointmentType === AppointmentTypeEnum.VIDEO) {
      if (timeDiffMinutes > 60) {
        this.logger.error('Appointment is too early in video');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      if (timeDiffMinutes < -30) {
        this.logger.error('Appointment is too late in video');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    const startOfToday = () => {
      const now = vnNow();
      return startOfDayVN(now);
    };

    const endOfToday = () => {
      const now = vnNow();
      return endOfDayVN(now);
    };

    const lastCheckedInAppointmentInDay =
      await this.appointmentRepository.findOne({
        where: {
          doctorId: appointment.doctorId,
          status: AppointmentStatusEnum.CHECKED_IN,
          scheduledAt: Between(startOfToday(), endOfToday()),
        },
        order: { checkInTime: 'DESC' },
      });
    const queueNumber = lastCheckedInAppointmentInDay?.queueNumber || 0;

    await this.appointmentRepository.update(id, {
      status: AppointmentStatusEnum.CHECKED_IN,
      checkInTime: new Date(),
      queueNumber: queueNumber + 1,
    });

    this.logger.log(
      `${appointment.appointmentType} appointment ${id} checked in at ${new Date().toISOString()}`,
    );

    return this.appointmentReadService.findById(id);
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

    return this.checkIn(appointment.id);
  }

  async checkInVideo(
    id: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.appointmentEntityService.findOne(id);

    if (!appointment) {
      this.logger.error('Appointment not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    if (appointment.status !== AppointmentStatusEnum.CONFIRMED) {
      this.logger.error('Appointment is not confirmed');
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

    await this.appointmentRepository.update(id, {
      status: AppointmentStatusEnum.CHECKED_IN,
      checkInTime: new Date(),
    });

    this.logger.log(`VIDEO appointment ${id} checked in`);

    return this.appointmentReadService.findById(id);
  }

  async startExamination(
    id: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    return this.dataSource.transaction(async (manager) => {
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

      await this.medicalService.upsertEncounterInTx(manager, appointment);

      this.logger.log(`Examination started for appointment ${id}`);

      return this.appointmentReadService.findById(id);
    });
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

    // Fire-and-forget PDF generation — don't block the response

    return this.appointmentReadService.findById(id);
  }
}
