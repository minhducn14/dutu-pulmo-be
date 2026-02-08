import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';

export class UpdateStatusDto {
  @ApiProperty({
    enum: AppointmentStatusEnum,
    description: 'Trạng thái mới của lịch hẹn',
  })
  @IsEnum(AppointmentStatusEnum)
  status: AppointmentStatusEnum;
}
