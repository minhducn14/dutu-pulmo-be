import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { RoleEnum } from '@/modules/common/enums/role.enum';

@Injectable()
export class AppointmentMedicalAccessService {
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
        throw new BadRequestException(
          'Chỉ có thể chỉnh sửa hồ sơ khi đang khám (IN_PROGRESS). Hồ sơ đã hoàn thành (COMPLETED) sẽ bị khóa.',
        );
      }
      throw new BadRequestException(
        'Chưa thể xem hồ sơ (Cuộc hẹn chưa bắt đầu)',
      );
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
      throw new ForbiddenException('Bạn không có quyền xem hồ sơ này');
    }
  }

  checkEditAccess(user: JwtUser, appt: { doctorId: string }) {
    const isAdmin = user.roles?.includes(RoleEnum.ADMIN);
    const isDoctor = user.doctorId === appt.doctorId;

    if (!isAdmin && !isDoctor) {
      throw new ForbiddenException(
        'Chỉ bác sĩ phụ trách hoặc admin mới có thể cập nhật',
      );
    }
  }
}
