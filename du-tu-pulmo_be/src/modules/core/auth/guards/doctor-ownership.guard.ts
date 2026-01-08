import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtUser } from '../strategies/jwt.strategy';
import { RoleEnum } from 'src/modules/common/enums/role.enum';
import { DoctorSchedule } from 'src/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from 'src/modules/doctor/entities/time-slot.entity';


@Injectable()
export class DoctorOwnershipGuard implements CanActivate {
  constructor(
    @InjectRepository(DoctorSchedule)
    private readonly scheduleRepository: Repository<DoctorSchedule>,
    @InjectRepository(TimeSlot)
    private readonly timeSlotRepository: Repository<TimeSlot>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtUser = request.user;
    const doctorIdParam = request.params.doctorId;

    if (!user) {
      throw new ForbiddenException('Không tìm thấy thông tin người dùng');
    }

    if (user.roles?.includes(RoleEnum.ADMIN)) {
      return true;
    }

    if (!user.doctorId) {
      throw new ForbiddenException('Bạn không phải bác sĩ');
    }
    if (user.doctorId !== doctorIdParam) {
      throw new ForbiddenException(
        'Bạn chỉ được quản lý lịch làm việc của mình',
      );
    }

    const scheduleId = request.params.scheduleId;
    if (scheduleId) {
      const schedule = await this.scheduleRepository.findOne({
        where: { id: scheduleId },
        select: ['id', 'doctorId'],
      });
      if (!schedule) {
        throw new ForbiddenException('Không tìm thấy schedule');
      }
      if (schedule.doctorId !== doctorIdParam) {
        throw new ForbiddenException('Schedule không thuộc bác sĩ này');
      }
    }

    const slotId = request.params.id;
    if (slotId && request.path.includes('/time-slots/')) {
      const slot = await this.timeSlotRepository.findOne({
        where: { id: slotId },
        select: ['id', 'doctorId'],
      });
      if (!slot) {
        throw new ForbiddenException('Không tìm thấy time slot');
      }
      if (slot.doctorId !== doctorIdParam) {
        throw new ForbiddenException('Time slot không thuộc bác sĩ này');
      }
    }

    return true;
  }
}
