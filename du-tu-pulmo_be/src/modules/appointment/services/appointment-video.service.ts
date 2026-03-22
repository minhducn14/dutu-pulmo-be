import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { DailyService } from '@/modules/video_call/daily.service';
import { CallStateService } from '@/modules/video_call/call-state.service';
import { MedicalService } from '@/modules/medical/medical.service';
import { AppointmentReadService } from '@/modules/appointment/services/appointment-read.service';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { CHECKIN_TIME_THRESHOLDS } from '@/modules/appointment/appointment.constants';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';
import { NotificationService } from '@/modules/notification/notification.service';

type VideoJoinWindowInput = {
  status: AppointmentStatusEnum;
  scheduledAt: Date;
  meetingUrl?: string | null;
};

export type VideoJoinInfo = {
  canJoin: boolean;
  minutesUntilStart: number;
  isEarly: boolean;
  isLate: boolean;
  message: string;
};

const VIDEO_JOIN_VALID_STATES: AppointmentStatusEnum[] = [
  AppointmentStatusEnum.CONFIRMED,
  AppointmentStatusEnum.CHECKED_IN,
  AppointmentStatusEnum.IN_PROGRESS,
];

@Injectable()
export class AppointmentVideoService {
  private readonly logger = new Logger(AppointmentVideoService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly dataSource: DataSource,
    private readonly dailyService: DailyService,
    private readonly callStateService: CallStateService,
    private readonly medicalService: MedicalService,
    private readonly appointmentReadService: AppointmentReadService,
    private readonly notificationService: NotificationService,
  ) {}

  getVideoJoinInfo(
    appointment: VideoJoinWindowInput,
    isDoctor: boolean = false,
  ): VideoJoinInfo {
    const now = new Date();
    const scheduledTime = new Date(appointment.scheduledAt);
    const minutesUntilStart = Math.round(
      (scheduledTime.getTime() - now.getTime()) / (1000 * 60),
    );

    const isEarly =
      minutesUntilStart > CHECKIN_TIME_THRESHOLDS.VIDEO.EARLY_MINUTES;
    const isLate =
      minutesUntilStart < -CHECKIN_TIME_THRESHOLDS.VIDEO.LATE_MINUTES;
    const isInProgress =
      appointment.status === AppointmentStatusEnum.IN_PROGRESS;
    const isValidState = VIDEO_JOIN_VALID_STATES.includes(appointment.status);

    // Bác sĩ luôn vào được nếu đúng trạng thái (bác sĩ tạo phòng)
    // Bệnh nhân chỉ vào được nếu đã có phòng (bác sĩ đã vào trước)
    const hasRoom = !!appointment.meetingUrl;
    const canJoinTimeWindow = isInProgress || (!isEarly && !isLate);

    let canJoin = isValidState && canJoinTimeWindow;
    let message = 'Bạn có thể join video call';

    if (!isDoctor && canJoin && !hasRoom) {
      // Nếu là bệnh nhân, đúng giờ nhưng bác sĩ chưa vào tạo phòng
      canJoin = false;
      message = 'Bác sĩ đang chuẩn bị phòng. Vui lòng quay lại sau ít phút.';
    } else if (!isValidState) {
      message = 'Không thể join ở trạng thái hiện tại';
    } else if (isEarly) {
      message = `Chưa đến giờ join. Vui lòng quay lại sau ${
        minutesUntilStart - CHECKIN_TIME_THRESHOLDS.VIDEO.EARLY_MINUTES
      } phút`;
    } else if (isLate) {
      message = 'Cuộc gọi đã kết thúc';
    }

    return { canJoin, minutesUntilStart, isEarly, isLate, message };
  }

  private validateVideoJoinWindowOrThrow(
    appointment: VideoJoinWindowInput,
  ): void {
    const isInProgress =
      appointment.status === AppointmentStatusEnum.IN_PROGRESS;
    if (isInProgress) {
      return;
    }

    const joinInfo = this.getVideoJoinInfo(appointment);
    if (joinInfo.isEarly || joinInfo.isLate) {
      this.logger.error(
        `Appointment outside video join window: status=${appointment.status}, minutesUntilStart=${joinInfo.minutesUntilStart}`,
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }
  }

  async generateMeetingToken(
    appointmentId: string,
    userId: string,
    userName: string,
    isDoctor: boolean,
  ): Promise<{
    token: string | null;
    url: string;
    appointment: ResponseCommon<AppointmentResponseDto>;
  }> {
    let appointment = await this.dataSource.transaction(async (manager) => {
      const apt = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!apt) {
        this.logger.error('Appointment not found');
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      const aptWithRelations = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        relations: ['patient', 'patient.user', 'doctor', 'doctor.user'],
      });

      if (!aptWithRelations) {
        this.logger.error('Appointment with relations not found');
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      if (isDoctor) {
        if (
          !aptWithRelations.doctor?.userId ||
          aptWithRelations.doctor.userId !== userId
        ) {
          this.logger.error('Doctor user ID mismatch');
          throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
        }
      } else {
        if (
          !aptWithRelations.patient?.userId ||
          aptWithRelations.patient.userId !== userId
        ) {
          this.logger.error('Patient user ID mismatch');
          throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
        }
      }

      if (aptWithRelations.appointmentType !== AppointmentTypeEnum.VIDEO) {
        this.logger.error('Appointment type is not video');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      if (!VIDEO_JOIN_VALID_STATES.includes(aptWithRelations.status)) {
        this.logger.error('Invalid status transition');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

      this.validateVideoJoinWindowOrThrow(aptWithRelations);

      return aptWithRelations;
    });

    let roomUrl = appointment.meetingUrl;
    let roomName = appointment.dailyCoChannel;

    if (!roomName) {
      if (isDoctor) {
        try {
          const room = await this.dailyService.getOrCreateRoom(appointmentId);
          roomUrl = room.url;
          roomName = room.name;

          await this.appointmentRepository.update(appointmentId, {
            meetingUrl: room.url,
            dailyCoChannel: room.name,
            meetingRoomId: room.id,
          });

          this.logger.log(
            `Created video room for appointment ${appointmentId}`,
          );
        } catch (error) {
          this.logger.error(`Failed to create room: ${error}`);
          throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
        }
      } else {
        this.logger.error('Patient cannot create room');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
    }

    let patientUserIdToNotify: string | null = null;
    let doctorUserIdToNotify: string | null = null;
    let appointmentNumber: string | null = null;

    appointment = await this.dataSource.transaction(async (manager) => {
      const apt = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!apt) {
        this.logger.error('Appointment not found');
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }
      const aptFull = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        relations: ['patient', 'patient.user', 'doctor', 'doctor.user'],
      });

      let statusChanged = false;
      let enteredInProgress = false;

      if (apt.status === AppointmentStatusEnum.CONFIRMED) {
        if (isDoctor) {
          apt.status = AppointmentStatusEnum.IN_PROGRESS;
          apt.startedAt = new Date();
          statusChanged = true;
          enteredInProgress = true;
          this.logger.log(
            `Auto check-in + start examination for VIDEO appointment ${appointmentId} (doctor joined)`,
          );
        } else {
          apt.checkInTime = new Date();
          apt.status = AppointmentStatusEnum.CHECKED_IN;
          statusChanged = true;
          this.logger.log(
            `Auto check-in for VIDEO appointment ${appointmentId} (patient joined)`,
          );
        }
      } else if (apt.status === AppointmentStatusEnum.CHECKED_IN && isDoctor) {
        apt.status = AppointmentStatusEnum.IN_PROGRESS;
        apt.startedAt = new Date();
        statusChanged = true;
        enteredInProgress = true;
        this.logger.log(
          `Auto start examination for VIDEO appointment ${appointmentId} (doctor joined after patient)`,
        );
      }

      if (statusChanged) {
        await manager.save(apt);
      }

      if (isDoctor && apt.status === AppointmentStatusEnum.IN_PROGRESS) {
        patientUserIdToNotify = aptFull?.patient?.user?.id ?? null;
        appointmentNumber = apt.appointmentNumber;
      }

      if (!isDoctor && apt.status === AppointmentStatusEnum.CHECKED_IN) {
        doctorUserIdToNotify = aptFull?.doctor?.user?.id ?? null;
        appointmentNumber = apt.appointmentNumber;
      }

      if (enteredInProgress) {
        await this.medicalService.upsertEncounterInTx(manager, apt);
        this.logger.log(
          `Auto start examination for VIDEO appointment ${appointmentId}`,
        );
      }
      return apt;
    });

    if (patientUserIdToNotify && appointmentNumber) {
      void this.notificationService.createNotification({
        userId: patientUserIdToNotify,
        type: NotificationTypeEnum.APPOINTMENT,
        title: 'Bác sĩ đang chờ bạn trong phòng khám',
        content: `Bác sĩ đã vào phòng. Vui lòng tham gia video call cho lịch hẹn ${appointmentNumber}.`,
        refId: appointmentId,
        refType: 'APPOINTMENT',
      });
    }

    if (doctorUserIdToNotify && appointmentNumber) {
      void this.notificationService.createNotification({
        userId: doctorUserIdToNotify,
        type: NotificationTypeEnum.APPOINTMENT,
        title: 'Bệnh nhân đang chờ trong phòng khám',
        content: `Bệnh nhân đã vào phòng. Vui lòng tham gia video call cho lịch hẹn ${appointmentNumber}.`,
        refId: appointmentId,
        refType: 'APPOINTMENT',
      });
    }

    try {
      const tokenData = await this.dailyService.createMeetingToken(
        roomName!,
        userId,
        userName,
        isDoctor,
      );

      await this.callStateService.setCurrentCall(
        userId,
        appointmentId,
        roomName,
      );

      const appointmentData =
        await this.appointmentReadService.findById(appointmentId);

      return {
        token: tokenData.token,
        url: roomUrl!,
        appointment: appointmentData,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate meeting token for ${appointmentId}: ${error}`,
      );
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }
  }

  async getUserCallStatus(userId: string): Promise<{
    inCall: boolean;
    currentCall?: {
      appointmentId: string;
      roomName: string;
      joinedAt: string;
    };
  }> {
    const currentCall = await this.callStateService.getCurrentCall(userId);
    return {
      inCall: !!currentCall,
      currentCall: currentCall
        ? {
            appointmentId: currentCall.appointmentId,
            roomName: currentCall.roomName,
            joinedAt: currentCall.joinedAt.toISOString(),
          }
        : undefined,
    };
  }

  async leaveCall(userId: string, appointmentId: string): Promise<void> {
    const currentCall = await this.callStateService.getCurrentCall(userId);
    this.logger.log(`leaveCall: ${JSON.stringify(currentCall)}`);
    if (!currentCall || currentCall.appointmentId !== appointmentId) {
      this.logger.error('Invalid call');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }

    await this.callStateService.clearCurrentCall(userId);
    this.logger.log(
      `User ${userId} left call for appointment ${appointmentId}`,
    );
  }

  getParticipantsInCall(appointmentId: string): Promise<string[]> {
    return this.callStateService.getUsersInCall(appointmentId);
  }
}
