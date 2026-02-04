import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Not, Repository } from 'typeorm';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import { ResponseCommon } from '@/common/dto/response.dto';
import { AppointmentResponseDto } from '@/modules/appointment/dto/appointment-response.dto';
import { APPOINTMENT_BASE_RELATIONS } from '@/modules/appointment/appointment.constants';
import { AppointmentMapperService } from '@/modules/appointment/services/appointment-mapper.service';

@Injectable()
export class AppointmentCalendarService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepository: Repository<Appointment>,
    private readonly mapper: AppointmentMapperService,
  ) {}

  async getCalendar(
    doctorId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ResponseCommon<AppointmentResponseDto[]>> {
    const daysDiff = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysDiff > 90) {
      throw new BadRequestException('Khoảng thời gian tối đa là 90 ngày');
    }

    const appointments = await this.appointmentRepository.find({
      where: {
        doctorId,
        scheduledAt: Between(startDate, endDate),
        status: Not(AppointmentStatusEnum.CANCELLED),
      },
      relations: APPOINTMENT_BASE_RELATIONS,
      order: { scheduledAt: 'ASC' },
    });

    return new ResponseCommon(
      200,
      'SUCCESS',
      appointments.map((a) => this.mapper.toDto(a)),
    );
  }
}
