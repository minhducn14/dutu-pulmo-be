import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { AdminActionType } from '../entities/admin-action.entity';
import { Type } from 'class-transformer';

export class QueryAdminActionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @ApiPropertyOptional({
    example: 20,
    description: 'Số lượng record mỗi trang (max 100)',
  })
  limit?: number = 20;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @ApiPropertyOptional({ example: 0, description: 'Offset để phân trang' })
  offset?: number = 0;

  @IsOptional()
  @IsEnum(AdminActionType)
  @ApiPropertyOptional({
    enum: AdminActionType,
    description: 'Lọc theo loại hành động',
  })
  actionType?: AdminActionType;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'Lọc theo admin user ID' })
  adminUserId?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ description: 'Lọc theo target user ID' })
  targetUserId?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ description: 'Lọc từ ngày (ISO format)' })
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({ description: 'Lọc đến ngày (ISO format)' })
  toDate?: string;

  @IsOptional()
  @ApiPropertyOptional({ description: 'Bao gồm cả các action đã void' })
  includeVoided?: boolean = false;
}
