import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { AppointmentStatusEnum } from 'src/modules/common/enums/appointment-status.enum';

/**
 * DTO for updating appointment status
 */
export class UpdateStatusDto {
  @ApiProperty({
    description: 'Trạng thái mới',
    enum: AppointmentStatusEnum,
    example: AppointmentStatusEnum.CONFIRMED,
  })
  @IsEnum(AppointmentStatusEnum)
  status: AppointmentStatusEnum;
}

/**
 * DTO for cancelling an appointment
 */
export class CancelAppointmentDto {
  @ApiProperty({
    description: 'Lý do hủy',
    example: 'Bệnh nhân bận việc đột xuất',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

/**
 * DTO for rescheduling an appointment
 */
export class RescheduleAppointmentDto {
  @ApiProperty({ description: 'ID time slot mới', format: 'uuid' })
  @IsUUID()
  newTimeSlotId: string;
}
