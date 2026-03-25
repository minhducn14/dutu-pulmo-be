import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { AppointmentReadService } from '@/modules/appointment/services/appointment-read.service';
import { AppointmentEntityService } from '@/modules/appointment/services/appointment-entity.service';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';
import { NotificationService } from '@/modules/notification/notification.service';
import { MedicalService } from '@/modules/medical/medical.service';
import { RichTextService } from '@/modules/appointment/services/rich-text.service';
import { validateTextFieldsPolicy } from '@/common/utils/text-fields-policy.util';

@Injectable()
export class AppointmentStatusService {
  private readonly logger = new Logger(AppointmentStatusService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
    private readonly appointmentReadService: AppointmentReadService,
    private readonly appointmentEntityService: AppointmentEntityService,
    private readonly notificationService: NotificationService,
    private readonly dataSource: DataSource,
    private readonly richTextService: RichTextService,
    @Inject(forwardRef(() => MedicalService))
    private readonly medicalService: MedicalService,
  ) {}

  async updateStatus(
    id: string,
    status: AppointmentStatusEnum,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    let createdEncounter: Pick<
      Awaited<ReturnType<MedicalService['upsertEncounterInTx']>>['record'],
      'id' | 'patientId' | 'recordNumber'
    > | null = null;

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const appointment = await manager.findOne(Appointment, {
        where: { id },
        relations: [
          'patient',
          'patient.user',
          'doctor',
          'doctor.user',
          'scheduleSlot',
        ],
      });

      if (!appointment) {
        this.logger.error('Appointment not found');
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      const validTransitions: Record<
        AppointmentStatusEnum,
        AppointmentStatusEnum[]
      > = {
        [AppointmentStatusEnum.PENDING_PAYMENT]: [
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.CANCELLED,
          AppointmentStatusEnum.PENDING,
        ],
        [AppointmentStatusEnum.PENDING]: [
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.CANCELLED,
        ],
        [AppointmentStatusEnum.CONFIRMED]: [
          AppointmentStatusEnum.CHECKED_IN,
          AppointmentStatusEnum.IN_PROGRESS,
          AppointmentStatusEnum.CANCELLED,
          AppointmentStatusEnum.NO_SHOW,
        ],
        [AppointmentStatusEnum.CHECKED_IN]: [
          AppointmentStatusEnum.IN_PROGRESS,
          AppointmentStatusEnum.CANCELLED,
        ],
        [AppointmentStatusEnum.IN_PROGRESS]: [
          AppointmentStatusEnum.COMPLETED,
          AppointmentStatusEnum.CANCELLED,
        ],
        [AppointmentStatusEnum.COMPLETED]: [],
        [AppointmentStatusEnum.CANCELLED]: [],
        [AppointmentStatusEnum.RESCHEDULED]: [
          AppointmentStatusEnum.CONFIRMED,
          AppointmentStatusEnum.CANCELLED,
        ],
        [AppointmentStatusEnum.NO_SHOW]: [],
      };

      const allowedNextStates = validTransitions[appointment.status] || [];
      if (!allowedNextStates.includes(status)) {
        this.logger.error('Invalid status transition');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      const updateData: Partial<Appointment> = { status };

      if (status === AppointmentStatusEnum.CONFIRMED) {
        if (
          appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
          !appointment.meetingUrl
        ) {
          try {
            const room = await this.dailyService.getOrCreateRoom(
              appointment.id,
            );
            updateData.meetingUrl = room.url;
            updateData.dailyCoChannel = room.name;
            this.logger.log(
              `Generated meeting URL for appointment ${appointment.id}`,
            );
          } catch (error) {
            this.logger.error(`Failed to generate meeting URL: ${error}`);
            throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
          }
        }
      } else if (status === AppointmentStatusEnum.IN_PROGRESS) {
        updateData.startedAt = new Date();
        // Ensure medical record is created
        const encounterResult = await this.medicalService.upsertEncounterInTx(
          manager,
          appointment,
        );
        if (encounterResult.created) {
          createdEncounter = encounterResult.record;
        }
      } else if (
        status === AppointmentStatusEnum.COMPLETED ||
        status === AppointmentStatusEnum.NO_SHOW
      ) {
        updateData.endedAt = new Date();

        if (
          appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
          appointment.dailyCoChannel
        ) {
          try {
            await this.dailyService.deleteRoom(appointment.dailyCoChannel);
            await this.callStateService.clearCallsForAppointment(
              appointment.id,
            );
            this.logger.log(
              `Cleaned up video room for appointment ${appointment.id}`,
            );
          } catch (error) {
            this.logger.warn(`Failed to cleanup video room: ${error}`);
          }
        }
      }

      await manager.update(Appointment, id, updateData);
    });

    if (createdEncounter) {
      this.medicalService.logAutoCreatedEncounter(createdEncounter);
    }

    return this.appointmentReadService.findById(id);
  }

  async confirmPayment(
    appointmentId: string,
    paymentId: string,
    paidAmount?: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment =
      await this.appointmentEntityService.findOne(appointmentId);

    if (!appointment) {
      this.logger.error('Appointment not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    if (appointment.status !== AppointmentStatusEnum.PENDING_PAYMENT) {
      this.logger.error('Invalid status transition');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    const updateData: Partial<Appointment> = {
      paymentId,
      paidAmount: paidAmount || appointment.feeAmount,
      status: AppointmentStatusEnum.CONFIRMED,
    };

    if (appointment.appointmentType === AppointmentTypeEnum.VIDEO) {
      try {
        const room = await this.dailyService.getOrCreateRoom(appointmentId);
        updateData.meetingUrl = room.url;
        updateData.dailyCoChannel = room.name;
        this.logger.log(
          `Generated meeting URL for paid appointment ${appointmentId}`,
        );
      } catch (error) {
        this.logger.error(`Failed to generate meeting URL: ${error}`);
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    await this.appointmentRepository.update(appointmentId, updateData);

    this.logger.log(
      `Payment confirmed for appointment ${appointmentId}, paymentId: ${paymentId}`,
    );

    const apptWithRelations =
      await this.appointmentEntityService.findOne(appointmentId);
    if (apptWithRelations?.patient?.user?.id) {
      void this.notificationService.createNotification({
        userId: apptWithRelations.patient.user.id,
        type: NotificationTypeEnum.PAYMENT,
        title: 'Thanh toán thành công',
        content: `Lịch hẹn ${apptWithRelations.appointmentNumber} đã được xác nhận. Hẹn gặp bạn vào ${apptWithRelations.scheduledAt.toLocaleDateString('vi-VN')}.`,
        refId: appointmentId,
        refType: 'APPOINTMENT',
      });
    }

    return this.appointmentReadService.findById(appointmentId);
  }

  async updateClinicalInfo(
    appointmentId: string,
    data: {
      chiefComplaint?: string;
      symptoms?: string[];
      patientNotes?: string;
      doctorNotes?: string;
    },
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment =
      await this.appointmentEntityService.findOne(appointmentId);

    if (!appointment) {
      this.logger.error('Appointment not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    const terminalStates = [
      AppointmentStatusEnum.COMPLETED,
      AppointmentStatusEnum.CANCELLED,
      AppointmentStatusEnum.NO_SHOW,
    ];

    if (terminalStates.includes(appointment.status)) {
      this.logger.error('Invalid status transition');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    validateTextFieldsPolicy({
      chiefComplaint: data.chiefComplaint,
      chiefComplaintErrorCode:
        ERROR_MESSAGES.APPOINTMENT_NOTES_CHIEF_COMPLAINT_PLAIN_TEXT_ONLY,
    });

    const sanitizedData = { ...data };

    if (sanitizedData.patientNotes) {
      sanitizedData.patientNotes =
        await this.richTextService.processPatientNotes(
          sanitizedData.patientNotes,
        );
    }

    if (sanitizedData.doctorNotes) {
      sanitizedData.doctorNotes = await this.richTextService.processDoctorNotes(
        sanitizedData.doctorNotes,
      );
    }

    await this.appointmentRepository.update(appointmentId, sanitizedData);

    this.logger.log(`Updated clinical info for appointment ${appointmentId}`);

    return this.appointmentReadService.findById(appointmentId);
  }
}
