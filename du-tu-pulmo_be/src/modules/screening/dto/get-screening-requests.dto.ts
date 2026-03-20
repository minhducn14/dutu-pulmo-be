import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { ScreeningStatusEnum } from '@/modules/common/enums/screening-status.enum';
import { ScreeningTypeEnum } from '@/modules/common/enums/screening-type.enum';

export class GetScreeningRequestsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter by screening status',
    enum: ScreeningStatusEnum,
  })
  @IsOptional()
  @IsEnum(ScreeningStatusEnum)
  status?: ScreeningStatusEnum;

  @ApiPropertyOptional({
    description: 'Filter by screening type',
    enum: ScreeningTypeEnum,
  })
  @IsOptional()
  @IsEnum(ScreeningTypeEnum)
  screeningType?: ScreeningTypeEnum;

  @ApiPropertyOptional({
    description: 'Filter by patient ID',
  })
  @IsOptional()
  @IsUUID()
  patientId?: string;
}
