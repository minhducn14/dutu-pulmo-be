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
import { CompleteExaminationDto } from '@/modules/appointment/dto/update-appointment.dto';
import {
  endOfDayVN,
  startOfDayVN,
  vnNow,
} from '@/common/datetime';

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

}
