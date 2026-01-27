import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { AdminActionType } from '../entities/admin-action.entity';

export class CreateAdminActionDto {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: '8b4e613c-6b85-41d5-bde3-ecbc1a7c1785',
    description: 'ID của user bị tác động (nếu có)',
  })
  targetUserId?: string;

  @IsNotEmpty()
  @IsEnum(AdminActionType, {
    message: `actionType phải là một trong: ${Object.values(AdminActionType).join(', ')}`,
  })
  @ApiProperty({
    example: AdminActionType.BAN_USER,
    enum: AdminActionType,
    description: 'Kiểu hành động',
  })
  actionType: AdminActionType;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'Vi phạm điều khoản sử dụng',
    description: 'Mô tả chi tiết (nếu có)',
  })
  description?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: 'medical_record',
    description: 'Loại resource bị tác động',
  })
  resourceType?: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    example: '9a5f2c3d-4e6b-7f8a-9b0c-1d2e3f4a5b6c',
    description: 'ID của resource bị tác động',
  })
  resourceId?: string;

  @IsOptional()
  @ApiPropertyOptional({
    example: { reason: 'Policy violation', severity: 'high' },
    description: 'Metadata bổ sung (JSON)',
  })
  metadata?: Record<string, any>;
}

export class VoidAdminActionDto {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({
    example: 'Ghi nhầm hành động, cần void để sửa',
    description: 'Lý do void action này',
  })
  reason: string;
}
