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
import { MedicalRecordStatusEnum } from '@/modules/common/enums/medical-record-status.enum';

@Injectable()
export class AppointmentMedicalAccessService {
  private readonly logger = new Logger(AppointmentMedicalAccessService.name);
  private readonly viewRecordStatuses = [
    MedicalRecordStatusEnum.DRAFT,
    MedicalRecordStatusEnum.IN_PROGRESS,
    MedicalRecordStatusEnum.COMPLETED,
    MedicalRecordStatusEnum.SUPERSEDED,
  ];

  private readonly editRecordStatuses = [
    MedicalRecordStatusEnum.DRAFT,
    MedicalRecordStatusEnum.IN_PROGRESS,
  ];

  validateMedicalRecordStatus(
    status: MedicalRecordStatusEnum,
    type: 'VIEW' | 'EDIT',
  ): void {
    const validStatuses =
      type === 'EDIT' ? this.editRecordStatuses : this.viewRecordStatuses;
    if (!validStatuses.includes(status)) {
      this.logger.error(`Medical record is not in a valid status for ${type}`);
      throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
    }
  }

  /**
   * @deprecated Use validateMedicalRecordStatus whenever possible
   */
  validateMedicalStatus(
    status: AppointmentStatusEnum,
    type: 'VIEW' | 'EDIT',
  ): void {
    const viewStatuses = [
      AppointmentStatusEnum.IN_PROGRESS,
      AppointmentStatusEnum.COMPLETED,
    ];
    const editStatuses = [AppointmentStatusEnum.IN_PROGRESS];
    const validStatuses = type === 'EDIT' ? editStatuses : viewStatuses;
    if (!validStatuses.includes(status)) {
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

  isViewStatus(status: AppointmentStatusEnum): boolean {
    const viewStatuses = [
      AppointmentStatusEnum.IN_PROGRESS,
      AppointmentStatusEnum.COMPLETED,
    ];
    return viewStatuses.includes(status);
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
