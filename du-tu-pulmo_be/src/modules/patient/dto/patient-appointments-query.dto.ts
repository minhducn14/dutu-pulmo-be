import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { AppointmentStatusEnum } from '@/modules/common/enums/appointment-status.enum';

export class PatientAppointmentsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by appointment status',
    enum: AppointmentStatusEnum,
  })
  @IsOptional()
  @IsEnum(AppointmentStatusEnum)
  status?: AppointmentStatusEnum;
}
