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
import {
  endOfDayVN,
  startOfDayVN,
  vnNow,
} from '@/common/datetime';
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
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== AppointmentStatusEnum.CONFIRMED) {
      throw new BadRequestException(
        'Bạn phải thực hiện thanh toán trước khi check-in',
      );
    }

    const now = new Date();
    const scheduledTime = new Date(appointment.scheduledAt);
    const timeDiffMinutes =
      (scheduledTime.getTime() - now.getTime()) / (1000 * 60);

    if (appointment.appointmentType === AppointmentTypeEnum.IN_CLINIC) {
      if (timeDiffMinutes > 30) {
        throw new BadRequestException(
          'Chưa đến giờ check-in. Vui lòng check-in trong vòng 30 phút trước giờ hẹn. ' +
            `(Còn ${Math.round(timeDiffMinutes)} phút nữa)`,
        );
      }

      if (timeDiffMinutes < -15) {
        throw new BadRequestException(
          `Đã quá giờ hẹn ${Math.abs(Math.round(timeDiffMinutes))} phút. ` +
            'Vui lòng liên hệ lễ tân để sắp xếp lại.',
        );
      }
    } else if (appointment.appointmentType === AppointmentTypeEnum.VIDEO) {
      if (timeDiffMinutes > 60) {
        throw new BadRequestException(
          'Chưa đến giờ check-in cho cuộc gọi video. ' +
            'Vui lòng check-in trong vòng 1 giờ trước giờ hẹn. ' +
            `(Còn ${Math.round(timeDiffMinutes)} phút nữa)`,
        );
      }

      if (timeDiffMinutes < -30) {
        throw new BadRequestException(
          `Đã quá giờ hẹn ${Math.abs(Math.round(timeDiffMinutes))} phút. ` +
            'Vui lòng liên hệ để được hỗ trợ.',
        );
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
      throw new NotFoundException(
        `Không tìm thấy lịch hẹn với mã ${appointmentNumber}`,
      );
    }

    return this.checkIn(appointment.id);
  }

  async checkInVideo(
    id: string,
  ): Promise<ResponseCommon<AppointmentResponseDto>> {
    const appointment = await this.appointmentEntityService.findOne(id);

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.status !== AppointmentStatusEnum.CONFIRMED) {
      throw new BadRequestException(
        'Bạn phải thực hiện thanh toán trước khi check-in',
      );
    }

    if (appointment.appointmentType !== AppointmentTypeEnum.VIDEO) {
      throw new BadRequestException(
        'This method is only for VIDEO appointments. Use /check-in for IN_CLINIC.',
      );
    }

    if (appointment.status !== AppointmentStatusEnum.CONFIRMED) {
      throw new BadRequestException(
        `Không thể check-in từ trạng thái ${String(appointment.status)}`,
      );
    }

    const now = new Date();
    const scheduledTime = new Date(appointment.scheduledAt);
    const timeDiffMinutes =
      (scheduledTime.getTime() - now.getTime()) / (1000 * 60);

    if (timeDiffMinutes > 60) {
      throw new BadRequestException(
        'Cuộc gọi video chưa mở. Vui lòng join trong vòng 1 giờ trước giờ hẹn.',
      );
    }

    if (timeDiffMinutes < -30) {
      throw new BadRequestException('Cuộc gọi video đã kết thúc.');
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
        throw new NotFoundException('Appointment not found');
      }

      if (appointment.status !== AppointmentStatusEnum.CHECKED_IN) {
        throw new BadRequestException(
          `Không thể bắt đầu khám từ trạng thái ${appointment.status}. ` +
            'Chỉ có thể bắt đầu khám khi ở trạng thái CHECKED_IN',
        );
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
        throw new NotFoundException('Appointment not found');
      }

      if (appointment.status !== AppointmentStatusEnum.IN_PROGRESS) {
        throw new BadRequestException(
          `Không thể hoàn thành khám từ trạng thái ${appointment.status}. ` +
            'Chỉ có thể hoàn thành khi đang khám (IN_PROGRESS)',
        );
      }

      const record = await manager.findOne(MedicalRecord, {
        where: { appointmentId: id },
      });

      if (!record) {
        throw new BadRequestException(
          'Medical record not found. This should not happen - record should be created when examination starts.',
        );
      }

      if (dto.physicalExamNotes)
        record.physicalExamNotes = dto.physicalExamNotes;
      if (dto.assessment) record.assessment = dto.assessment;
      if (dto.diagnosisNotes) record.diagnosisNotes = dto.diagnosisNotes;
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

      return appointment;
    });

    if (
      result.appointmentType === AppointmentTypeEnum.VIDEO &&
      result.dailyCoChannel
    ) {
      try {
        await this.dailyService.deleteRoom(result.dailyCoChannel);
        await this.callStateService.clearCallsForAppointment(result.id);
        this.logger.log(
          `Cleaned up video room for completed appointment ${result.id}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup video room for ${result.id}: ${error}`,
        );
      }
    }

    return this.appointmentReadService.findById(id);
  }
}
