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
  ) {}

  async generateMeetingToken(
    appointmentId: string,
    userId: string,
    userName: string,
    isDoctor: boolean,
  ): Promise<{ token: string; url: string }> {
    let appointment = await this.dataSource.transaction(async (manager) => {
      const apt = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        relations: ['patient', 'patient.user', 'doctor', 'doctor.user'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!apt) {
        throw new NotFoundException('Appointment not found');
      }

      if (isDoctor) {
        if (!apt.doctor?.userId || apt.doctor.userId !== userId) {
          throw new ForbiddenException(
            'Bạn không phải là bác sĩ của cuộc hẹn này',
          );
        }
      } else {
        if (!apt.patient?.userId || apt.patient.userId !== userId) {
          throw new ForbiddenException(
            'Bạn không phải là bệnh nhân của cuộc hẹn này',
          );
        }
      }

      if (apt.appointmentType !== AppointmentTypeEnum.VIDEO) {
        throw new BadRequestException('This is not a video appointment');
      }

      const validStates = [
        AppointmentStatusEnum.CONFIRMED,
        AppointmentStatusEnum.CHECKED_IN,
        AppointmentStatusEnum.IN_PROGRESS,
      ];

      if (!validStates.includes(apt.status)) {
        throw new BadRequestException(
          `Cannot join meeting in status: ${apt.status}`,
        );
      }

      return apt;
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
          throw new BadRequestException(
            'Không thể tạo phòng họp video. Vui lòng thử lại.',
          );
        }
      } else {
        throw new BadRequestException(
          'Phòng họp chưa được tạo. Vui lòng đợi bác sĩ bắt đầu cuộc gọi trước khi tham gia.',
        );
      }
    }

    appointment = await this.dataSource.transaction(async (manager) => {
      const apt = await manager.findOne(Appointment, {
        where: { id: appointmentId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!apt) {
        throw new NotFoundException('Appointment not found');
      }

      let statusChanged = false;
      let enteredInProgress = false;

      if (apt.status === AppointmentStatusEnum.CONFIRMED) {
        if (isDoctor) {
          apt.checkInTime = apt.checkInTime || new Date();
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

      if (enteredInProgress) {
        await this.medicalService.upsertEncounterInTx(manager, apt);
      }

      return apt;
    });

    try {
      const tokenData = await this.dailyService.createMeetingToken(
        roomName,
        userId,
        userName,
        isDoctor,
      );

      await this.callStateService.setCurrentCall(userId, appointmentId, roomName);

      return {
        token: tokenData.token,
        url: roomUrl,
      };
    } catch (error) {
      this.logger.error(
        `Failed to generate meeting token for ${appointmentId}: ${error}`,
      );
      throw new BadRequestException(
        'Không thể tạo token join video. Vui lòng thử lại.',
      );
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

    if (!currentCall || currentCall.appointmentId !== appointmentId) {
      throw new BadRequestException('User is not in this call');
    }

    await this.callStateService.clearCurrentCall(userId);
    this.logger.log(
      `User ${userId} left call for appointment ${appointmentId}`,
    );
  }
}
