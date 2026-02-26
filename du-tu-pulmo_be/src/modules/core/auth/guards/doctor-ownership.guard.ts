import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

@Injectable()
export class DoctorOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();
    const user = request.user;
    const doctorIdParam = request.params.doctorId;

    if (!user) {
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
    }

    if (user.roles?.includes(RoleEnum.ADMIN)) {
      return true;
    }

    if (!user.doctorId) {
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
    }
    if (user.doctorId !== doctorIdParam) {
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
    }

    const scheduleId = request.params.scheduleId;
    if (scheduleId) {
      const schedule = await this.scheduleRepository.findOne({
        where: { id: scheduleId as string },
        select: ['id', 'doctorId'],
      });
      if (!schedule) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
      }
      if (schedule.doctorId !== doctorIdParam) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
      }
    }

    const slotId = request.params.id;
    if (slotId && request.path.includes('/time-slots/')) {
      const slot = await this.timeSlotRepository.findOne({
        where: { id: slotId as string },
        select: ['id', 'doctorId'],
      });
      if (!slot) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
      }
      if (slot.doctorId !== doctorIdParam) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
      }
    }

    return true;
  }
}
