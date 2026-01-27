import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsObject,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';
import { ScreeningTypeEnum } from '../../common/enums/screening-type.enum';

export class CreateScreeningRequestDto {
  @ApiProperty({
    description: 'ID bệnh nhân',
    example: 'uuid-patient-id',
  })
  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @ApiPropertyOptional({
    enum: ScreeningTypeEnum,
    default: ScreeningTypeEnum.XRAY,
    description: 'Loại sàng lọc',
  })
  @IsEnum(ScreeningTypeEnum)
  @IsOptional()
  screeningType?: ScreeningTypeEnum;

  @ApiPropertyOptional({
    description: 'Nguồn tạo yêu cầu (WEB, MOBILE, etc.)',
    example: 'WEB',
  })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiPropertyOptional({
    description: 'Thông tin thiết bị',
    example: { browser: 'Chrome', os: 'Windows' },
  })
  @IsObject()
  @IsOptional()
  deviceInfo?: Record<string, any>;
}
