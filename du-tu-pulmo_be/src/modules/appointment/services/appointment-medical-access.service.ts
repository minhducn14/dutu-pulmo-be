import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

@Injectable()
export class AppointmentMedicalAccessService {
  private readonly logger = new Logger(AppointmentMedicalAccessService.name);
  private readonly viewStatuses = [
    AppointmentStatusEnum.IN_PROGRESS,
    AppointmentStatusEnum.COMPLETED,
  ];

  private readonly editStatuses = [AppointmentStatusEnum.IN_PROGRESS];

  isViewStatus(status: AppointmentStatusEnum): boolean {
    return this.viewStatuses.includes(status);
  }

  validateMedicalStatus(
    status: AppointmentStatusEnum,
    type: 'VIEW' | 'EDIT',
  ): void {
    const validStatuses =
      type === 'EDIT' ? this.editStatuses : this.viewStatuses;
    if (!validStatuses.includes(status)) {
      if (type === 'EDIT') {
        this.logger.error('Appointment is not in progress');
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }
      this.logger.error('Appointment is not in progress');
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }
  }

  checkViewAccess(
    user: JwtUser,
    appt: { doctorId: string; patientId: string },
  ) {
    const isAdmin = user.roles?.includes(RoleEnum.ADMIN);
    const isDoctor = user.doctorId === appt.doctorId;
    const isPatient = user.patientId === appt.patientId;

    if (!isAdmin && !isDoctor && !isPatient) {
      this.logger.error('Access denied');
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
    }
  }

  checkEditAccess(user: JwtUser, appt: { doctorId: string }) {
    const isAdmin = user.roles?.includes(RoleEnum.ADMIN);
    const isDoctor = user.doctorId === appt.doctorId;

    if (!isAdmin && !isDoctor) {
      this.logger.error('Access denied');
      throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
    }
  }
}
