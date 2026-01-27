import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Số trang (bắt đầu từ 1)',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng items mỗi trang',
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class PaginationMeta {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export class PaginationMetaDto extends PaginationMeta {
  @ApiProperty({ example: 1 })
  declare currentPage: number;

  @ApiProperty({ example: 10 })
  declare itemsPerPage: number;

  @ApiProperty({ example: 100 })
  declare totalItems: number;

  @ApiProperty({ example: 10 })
  declare totalPages: number;

  @ApiProperty({ example: true })
  declare hasNextPage: boolean;

  @ApiProperty({ example: false })
  declare hasPreviousPage: boolean;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ isArray: true, type: Object })
  items: T[];
  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;

  constructor(items: T[], totalItems: number, page: number, limit: number) {
    const totalPages = Math.ceil(totalItems / limit);
    this.items = items;
    this.meta = {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}
