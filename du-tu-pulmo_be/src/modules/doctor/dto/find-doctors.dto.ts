import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { SpecialtyEnum } from '@/modules/common/enums/specialty.enum';
import { AppointmentTypeFilterEnum } from '@/modules/doctor/dto/appointment-type-filter.enum';

export class FindDoctorsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo chuyên khoa',
    enum: SpecialtyEnum,
  })
  @IsOptional()
  @IsEnum(SpecialtyEnum)
  specialty?: SpecialtyEnum;

  @ApiPropertyOptional({
    description: 'Lọc theo bệnh viện (Hospital ID)',
    example: 'uuid-hospital-id',
  })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional({
    description: 'Lọc bác sĩ theo loại lịch tương lai',
    enum: AppointmentTypeFilterEnum,
    default: AppointmentTypeFilterEnum.ALL,
  })
  @IsOptional()
  @IsEnum(AppointmentTypeFilterEnum)
  appointmentType?: AppointmentTypeFilterEnum;
}

