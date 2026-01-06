import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsArray,
} from 'class-validator';
import { AppointmentTypeEnum } from 'src/modules/common/enums/appointment-type.enum';

/**
 * DTO for creating a new appointment
 */
export class CreateAppointmentDto {
  @ApiProperty({ description: 'ID bệnh nhân', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiProperty({ description: 'ID bác sĩ', format: 'uuid' })
  @IsUUID()
  doctorId: string;

  @ApiProperty({ description: 'ID khung giờ', format: 'uuid' })
  @IsUUID()
  timeSlotId: string;

  @ApiPropertyOptional({ description: 'ID bệnh viện', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional({
    description: 'Loại hình khám',
    enum: AppointmentTypeEnum,
    example: AppointmentTypeEnum.IN_CLINIC,
  })
  @IsOptional()
  @IsEnum(AppointmentTypeEnum)
  appointmentType?: AppointmentTypeEnum;

  @ApiPropertyOptional({ description: 'Thời lượng khám (phút)', example: 30 })
  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @ApiPropertyOptional({ description: 'Phí khám', example: '200000' })
  @IsOptional()
  @IsString()
  feeAmount?: string;

  @ApiPropertyOptional({ description: 'Lý do khám chính' })
  @IsOptional()
  @IsString()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'Triệu chứng', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @ApiPropertyOptional({ description: 'Ghi chú của bệnh nhân' })
  @IsOptional()
  @IsString()
  patientNotes?: string;
}
