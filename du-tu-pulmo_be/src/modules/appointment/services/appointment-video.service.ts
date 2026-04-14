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
      throw new BadRequestException(ERROR_MESSAGES.NOT_IN_CALL_WINDOW);
    }
  }

  private validateParticipantAccess(
    appointment: Appointment,
    userId: string,
    isDoctor: boolean,
  ): void {
    if (isDoctor) {
      if (!appointment.doctor?.userId || appointment.doctor.userId !== userId) {
        this.logger.error('Doctor user ID mismatch');
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_VIDEO_CALL);
      }
      return;
    }

    if (!appointment.patient?.userId || appointment.patient.userId !== userId) {
      this.logger.error('Patient user ID mismatch');
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED_VIDEO_CALL);
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
    const preflightAppointment = await this.appointmentRepository.findOne({
      where: { id: appointmentId },
      relations: ['patient', 'patient.user', 'doctor', 'doctor.user'],
    });

    if (!preflightAppointment) {
      this.logger.error('Appointment not found');
      throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
    }

    this.validateParticipantAccess(preflightAppointment, userId, isDoctor);

    if (preflightAppointment.appointmentType !== AppointmentTypeEnum.VIDEO) {
      this.logger.error('Appointment type is not video');
      throw new BadRequestException(ERROR_MESSAGES.NOT_VIDEO_APPOINTMENT);
    }

    if (!VIDEO_JOIN_VALID_STATES.includes(preflightAppointment.status)) {
      this.logger.error('Invalid video join status');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_STATUS_TRANSITION);
    }

    this.validateVideoJoinWindowOrThrow(preflightAppointment);

    let pendingRoom: { id: string; name: string; url: string } | null = null;

    if (!preflightAppointment.dailyCoChannel) {
      if (!isDoctor) {
        this.logger.error('Patient cannot create room');
        throw new BadRequestException(ERROR_MESSAGES.VIDEO_CALL_NOT_STARTED);
      }

      try {
        const room = await this.dailyService.getOrCreateRoom(appointmentId);
        pendingRoom = {
          id: room.id,
          name: room.name,
          url: room.url,
        };
      } catch (error) {
        this.logger.error(`Failed to create room: ${error}`);
        throw new BadRequestException(ERROR_MESSAGES.VIDEO_ROOM_CREATE_FAILED);
      }
    }

    let patientUserIdToNotify: string | null = null;
    let doctorUserIdToNotify: string | null = null;
    let appointmentNumber: string | null = null;
    let createdEncounter: Pick<
      Awaited<ReturnType<MedicalService['upsertEncounterInTx']>>['record'],
      'id' | 'patientId' | 'recordNumber'
    > | null = null;
    const joinResult = await this.dataSource.transaction(async (manager) => {
      const aptFull = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!aptFull) {
        this.logger.error('Appointment not found');
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      this.validateParticipantAccess(preflightAppointment, userId, isDoctor);

      if (aptFull.appointmentType !== AppointmentTypeEnum.VIDEO) {
        this.logger.error('Appointment type is not video');
        throw new BadRequestException(ERROR_MESSAGES.NOT_VIDEO_APPOINTMENT);
      }

      if (!VIDEO_JOIN_VALID_STATES.includes(aptFull.status)) {
        this.logger.error('Invalid video join status');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_STATUS_TRANSITION);
      }

      this.validateVideoJoinWindowOrThrow(aptFull);

      const apt = aptFull;
      let roomName = apt.dailyCoChannel;
      let roomUrl = apt.meetingUrl;

      if (!roomName) {
        if (!isDoctor || !pendingRoom) {
          this.logger.error('Video room is not ready');
          throw new BadRequestException(ERROR_MESSAGES.VIDEO_CALL_NOT_STARTED);
        }

        apt.meetingUrl = pendingRoom.url;
        apt.dailyCoChannel = pendingRoom.name;
        apt.meetingRoomId = pendingRoom.id;
        roomName = pendingRoom.name;
        roomUrl = pendingRoom.url;
      }

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
        patientUserIdToNotify = preflightAppointment?.patient?.user?.id ?? null;
        appointmentNumber = apt.appointmentNumber;
      }

      if (!isDoctor && apt.status === AppointmentStatusEnum.CHECKED_IN) {
        doctorUserIdToNotify = preflightAppointment?.doctor?.user?.id ?? null;
        appointmentNumber = apt.appointmentNumber;
      }

      if (enteredInProgress) {
        const encounterResult = await this.medicalService.upsertEncounterInTx(
          manager,
          apt,
        );
        if (encounterResult.created) {
          createdEncounter = encounterResult.record;
        }
        this.logger.log(
          `Auto start examination for VIDEO appointment ${appointmentId}`,
        );
      }

      await manager.save(apt);

      let tokenData;
      try {
        tokenData = await this.dailyService.createMeetingToken(
          roomName,
          userId,
          userName,
          isDoctor,
        );
      } catch (error) {
        this.logger.error(
          `Failed to generate meeting token for ${appointmentId}: ${error}`,
        );
        throw new BadRequestException(
          ERROR_MESSAGES.VIDEO_TOKEN_GENERATE_FAILED,
        );
      }

      return {
        token: tokenData.token,
        url: roomUrl!,
        roomName: roomName,
      };
    });

    if (createdEncounter) {
      this.medicalService.logAutoCreatedEncounter(createdEncounter);
    }

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

    await this.callStateService.setCurrentCall(
      userId,
      appointmentId,
      joinResult.roomName,
    );

    const appointmentData =
      await this.appointmentReadService.findById(appointmentId);

    return {
      token: joinResult.token,
      url: joinResult.url,
      appointment: appointmentData,
    };
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
