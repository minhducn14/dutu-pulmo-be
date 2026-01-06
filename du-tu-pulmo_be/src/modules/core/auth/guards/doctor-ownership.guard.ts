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

/**
 * SEC-01: Guard to verify doctor ownership of schedules and time slots
 * Validates that:
 * 1. User is admin (bypass) or has matching doctorId
 * 2. Any scheduleId in params belongs to the doctorId
 * 3. Any timeSlotId in params belongs to the doctorId
 */
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

    // Admin can access anything
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

    // SEC-01: Verify scheduleId belongs to doctor (for /schedules/:scheduleId/... routes)
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

    // SEC-01: Verify timeSlotId belongs to doctor (for /time-slots/:id routes)
    // Note: Only check if route contains 'time-slots' and has :id param
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
