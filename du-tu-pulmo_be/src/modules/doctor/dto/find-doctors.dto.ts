import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';

export class FindDoctorsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo chuyên khoa (Specialty ID)',
    example: 'uuid-specialty-id',
  })
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo chuyên khoa phụ (SubSpecialty ID)',
    example: 'uuid-sub-specialty-id',
  })
  @IsOptional()
  @IsUUID()
  subSpecialtyId?: string;

  @ApiPropertyOptional({
    description: 'Lọc theo bệnh viện (Hospital ID)',
    example: 'uuid-hospital-id',
  })
  @IsOptional()
  @IsUUID()
  hospitalId?: string;
}
