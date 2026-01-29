import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { SpecialtyEnum } from '@/modules/common/enums/specialty.enum';

export class FindDoctorsDto extends PaginationDto {
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
}
