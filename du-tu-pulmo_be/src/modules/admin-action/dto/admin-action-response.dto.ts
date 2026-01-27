import { ApiProperty } from '@nestjs/swagger';

export class AdminActionResponseDto {
  @ApiProperty({ example: 'b0c727b1-0c35-40f3-87da-d4eabdc4b023' })
  id: string;

  @ApiProperty({ example: '3f7be1ae-c9d6-43ae-8bcf-145d13238a3e' })
  adminId: string;

  @ApiProperty({ example: '8b4e613c-6b85-41d5-bde3-ecbc1a7c1785' })
  targetId: string;

  @ApiProperty({ example: 'BAN_USER' })
  actionType: string;

  @ApiProperty({ example: 'Vi phạm điều khoản sử dụng', required: false })
  description?: string;

  @ApiProperty({
    example: '2024-07-17T14:12:40.000Z',
    description: 'Ngày thực hiện',
    required: false,
  })
  createdAt?: string;

  static fromEntity(action: {
    id: string;
    adminUserId: string;
    targetUserId?: string | null;
    actionType: string;
    description?: string | null;
    createdAt?: Date | string | null;
  }): AdminActionResponseDto {
    const dto = new AdminActionResponseDto();
    dto.id = action.id;
    dto.adminId = action.adminUserId;
    dto.targetId = action.targetUserId ?? '';
    dto.actionType = action.actionType;
    dto.description = action.description ?? undefined;
    if (action.createdAt) {
      dto.createdAt =
        action.createdAt instanceof Date
          ? action.createdAt.toISOString()
          : action.createdAt;
    }
    return dto;
  }

  static fromNullable(
    action:
      | Parameters<typeof AdminActionResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): AdminActionResponseDto | null {
    return action ? AdminActionResponseDto.fromEntity(action) : null;
  }
}
