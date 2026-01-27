import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

export class AuditLogResponseDto {
  @ApiProperty({ example: 'b65a4f0b-1e4c-4f55-8a7b-0b2e5c0d96a8' })
  id: string;

  @ApiPropertyOptional({ example: '3c2e73f2-81d1-4b8a-9d5f-8b2f2a6c2f4b' })
  userId?: string;

  @ApiProperty({ enum: AuditActionEnum, example: AuditActionEnum.CREATE })
  action: AuditActionEnum;

  @ApiProperty({ example: 'users' })
  tableName: string;

  @ApiPropertyOptional({ example: 'a33b1c10-7f26-4f1b-9a2a-6a6d4a5f9b93' })
  recordId?: string;

  @ApiPropertyOptional({ type: Object })
  oldValues?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  newValues?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  ipAddress?: string;

  @ApiPropertyOptional({ example: 'Mozilla/5.0' })
  userAgent?: string;

  @ApiPropertyOptional({ example: 'POST' })
  requestMethod?: string;

  @ApiPropertyOptional({ example: '/users' })
  requestUrl?: string;

  @ApiProperty({ example: true })
  success: boolean;

  @ApiPropertyOptional({ example: 'Validation error' })
  errorMessage?: string;

  @ApiProperty({ example: '2024-10-11T09:30:00.000Z' })
  createdAt: Date;

  static fromEntity(log: {
    id: string;
    userId?: string | null;
    action: AuditActionEnum;
    tableName: string;
    recordId?: string | null;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestMethod?: string | null;
    requestUrl?: string | null;
    success: boolean;
    errorMessage?: string | null;
    createdAt: Date;
  }): AuditLogResponseDto {
    const dto = new AuditLogResponseDto();
    dto.id = log.id;
    dto.userId = log.userId ?? undefined;
    dto.action = log.action;
    dto.tableName = log.tableName;
    dto.recordId = log.recordId ?? undefined;
    dto.oldValues = log.oldValues ?? undefined;
    dto.newValues = log.newValues ?? undefined;
    dto.ipAddress = log.ipAddress ?? undefined;
    dto.userAgent = log.userAgent ?? undefined;
    dto.requestMethod = log.requestMethod ?? undefined;
    dto.requestUrl = log.requestUrl ?? undefined;
    dto.success = log.success;
    dto.errorMessage = log.errorMessage ?? undefined;
    dto.createdAt = log.createdAt;
    return dto;
  }

  static fromNullable(
    log:
      | Parameters<typeof AuditLogResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): AuditLogResponseDto | null {
    return log ? AuditLogResponseDto.fromEntity(log) : null;
  }
}
