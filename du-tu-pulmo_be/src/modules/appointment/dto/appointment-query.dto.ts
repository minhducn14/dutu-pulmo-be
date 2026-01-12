import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { AppointmentStatusEnum } from '../../common/enums/appointment-status.enum';
import { AppointmentTypeEnum } from '../../common/enums/appointment-type.enum';

/**
 * DTO cho query danh sách lịch hẹn với phân trang và bộ lọc
 */
export class AppointmentQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái lịch hẹn',
    enum: AppointmentStatusEnum,
  })
  @IsOptional()
  @IsEnum(AppointmentStatusEnum)
  status?: AppointmentStatusEnum;

  @ApiPropertyOptional({
    description: 'Lọc theo loại lịch hẹn (IN_CLINIC hoặc VIDEO)',
    enum: AppointmentTypeEnum,
  })
  @IsOptional()
  @IsEnum(AppointmentTypeEnum)
  appointmentType?: AppointmentTypeEnum;

  @ApiPropertyOptional({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

/**
 * DTO cho query lịch hẹn theo patient/doctor với phân trang
 */
export class PatientAppointmentQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái',
    enum: AppointmentStatusEnum,
  })
  @IsOptional()
  @IsEnum(AppointmentStatusEnum)
  status?: AppointmentStatusEnum;
}
