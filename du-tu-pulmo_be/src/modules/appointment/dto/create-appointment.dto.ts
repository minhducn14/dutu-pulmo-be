import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { AppointmentTypeEnum } from '@/modules/common/enums/appointment-type.enum';
import { AppointmentSubTypeEnum } from '@/modules/common/enums/appointment-sub-type.enum';
import { SourceTypeEnum } from '@/modules/common/enums/source-type.enum';

/**
 * DTO for creating a new appointment
 */
export class CreateAppointmentDto {
  @ApiProperty({ description: 'ID khung giờ', format: 'uuid' })
  @IsNotEmpty()
  @IsUUID()
  timeSlotId: string;

  @ApiPropertyOptional({ description: 'ID bệnh nhân', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({
    description: 'ID bệnh viện (dùng cho IN_CLINIC)',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional({
    description:
      'Loại con (INSTANT: Khám ngay, SCHEDULED: Đặt lịch, RE_EXAM: Tái khám)',
    enum: AppointmentSubTypeEnum,
    default: AppointmentSubTypeEnum.SCHEDULED,
  })
  @IsOptional()
  @IsEnum(AppointmentSubTypeEnum)
  subType?: AppointmentSubTypeEnum;

  @ApiPropertyOptional({
    description: 'Nguồn đặt lịch (INTERNAL: Tại cơ sở, EXTERNAL: Online)',
    enum: SourceTypeEnum,
    default: SourceTypeEnum.EXTERNAL,
  })
  @IsOptional()
  @IsEnum(SourceTypeEnum)
  sourceType?: SourceTypeEnum;

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
