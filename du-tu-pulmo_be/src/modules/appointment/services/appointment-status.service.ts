import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { AppointmentReadService } from '@/modules/appointment/services/appointment-read.service';
import { AppointmentEntityService } from '@/modules/appointment/services/appointment-entity.service';

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
  ) {}

  async updateStatus(
    id: string,
    status: AppointmentStatusEnum,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.appointmentEntityService.findOne(id);

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
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
    };

    const allowedNextStates = validTransitions[appointment.status] || [];
    if (!allowedNextStates.includes(status)) {
      throw new BadRequestException(
        `Không thể chuyển từ trạng thái ${appointment.status} sang ${status}`,
      );
    }

    const updateData: Partial<Appointment> = { status };

    if (status === AppointmentStatusEnum.CONFIRMED) {
      if (
        appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
        !appointment.meetingUrl
      ) {
        try {
          const room = await this.dailyService.getOrCreateRoom(appointment.id);
          updateData.meetingUrl = room.url;
          updateData.dailyCoChannel = room.name;
          this.logger.log(
            `Generated meeting URL for appointment ${appointment.id}`,
          );
        } catch (error) {
          this.logger.error(`Failed to generate meeting URL: ${error}`);
          throw new BadRequestException('Không thể tạo phòng họp video');
        }
      }
    } else if (status === AppointmentStatusEnum.IN_PROGRESS) {
      updateData.startedAt = new Date();
    } else if (status === AppointmentStatusEnum.COMPLETED) {
      updateData.endedAt = new Date();

      if (
        appointment.appointmentType === AppointmentTypeEnum.VIDEO &&
        appointment.dailyCoChannel
      ) {
        try {
          await this.dailyService.deleteRoom(appointment.dailyCoChannel);
          await this.callStateService.clearCallsForAppointment(appointment.id);
          this.logger.log(
            `Cleaned up video room for appointment ${appointment.id}`,
          );
        } catch (error) {
          this.logger.warn(`Failed to cleanup video room: ${error}`);
        }
      }
    }

    await this.appointmentRepository.update(id, updateData);
    await this.appointmentRepository.update(id, {
      status: AppointmentStatusEnum.IN_PROGRESS,
    });
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
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== AppointmentStatusEnum.PENDING_PAYMENT) {
      throw new BadRequestException(
        `Không thể xác nhận thanh toán cho lịch hẹn ở trạng thái ${appointment.status}`,
      );
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
        throw new BadRequestException('Không thể tạo phòng họp video');
      }
    }

    await this.appointmentRepository.update(appointmentId, updateData);

    this.logger.log(
      `Payment confirmed for appointment ${appointmentId}, paymentId: ${paymentId}`,
    );

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
      throw new NotFoundException('Appointment not found');
    }

    const terminalStates = [
      AppointmentStatusEnum.COMPLETED,
      AppointmentStatusEnum.CANCELLED,
    ];

    if (terminalStates.includes(appointment.status)) {
      throw new BadRequestException(
        `Không thể cập nhật thông tin lâm sàng cho lịch hẹn ở trạng thái ${appointment.status}`,
      );
    }

    await this.appointmentRepository.update(appointmentId, data);

    this.logger.log(`Updated clinical info for appointment ${appointmentId}`);

    return this.appointmentReadService.findById(appointmentId);
  }
}
