import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';

/**
 * DTO for creating a new appointment
 */
export class CreateAppointmentDto {
  @ApiProperty({ description: 'ID khung giờ', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  timeSlotId: string;

  // Optional fields
  @ApiProperty({ description: 'ID bệnh nhân', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({
    description: 'Loại hình khám (default: lấy từ slot)',
    enum: AppointmentTypeEnum,
  })
  @IsOptional()
  @IsEnum(AppointmentTypeEnum)
  appointmentType?: AppointmentTypeEnum;

  @ApiPropertyOptional({ description: 'ID bệnh viện (dùng cho IN_CLINIC)', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional({ description: 'Lý do khám chính' })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Các triệu chứng', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @ApiPropertyOptional({ description: 'Ghi chú của bệnh nhân' })
  @IsOptional()
  @IsString()
  patientNotes?: string;
}
