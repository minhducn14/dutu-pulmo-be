import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { RoleEnum } from '../../common/enums/role.enum';

/**
 * DTO cho query danh sách users với phân trang và bộ lọc
 */
export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Lọc theo role',
    enum: RoleEnum,
  })
  @IsOptional()
  @IsEnum(RoleEnum)
  role?: RoleEnum;

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái (active, inactive, suspended)',
    example: 'active',
  })
  @IsOptional()
  status?: string;
}
