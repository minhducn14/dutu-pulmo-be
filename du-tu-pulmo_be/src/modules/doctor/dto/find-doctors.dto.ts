import { IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Specialty } from 'src/modules/common/enums/specialty.enum';

export class FindDoctorsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo chuyên khoa',
    enum: Specialty,
  })
  @IsOptional()
  @IsEnum(Specialty)
  specialty?: Specialty;

  @ApiPropertyOptional({
    description: 'Lọc theo bệnh viện (Hospital ID)',
    example: 'uuid-hospital-id',
  })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
