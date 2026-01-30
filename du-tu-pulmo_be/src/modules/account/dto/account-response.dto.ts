import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '@/modules/common/enums/role.enum';

export class AccountResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'user@email.com' })
  email: string;

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ example: '2024-07-20T09:12:23.000Z', required: false })
  lastLoginAt?: Date;

  // Thông tin user (profile)
  @ApiProperty({ example: 'Nguyễn Văn A', required: false })
  fullName?: string;

  @ApiProperty({ example: '0123456789', required: false })
  phone?: string;

  @ApiProperty()
  roles: RoleEnum[];

  @ApiProperty({ required: false })
  deletedAt?: Date;

  @ApiProperty({ required: false })
  deletedBy?: string;

  @ApiProperty({ required: false })
  deleteReason?: string;

  static fromEntity(account: {
    id: string;
    email: string;
    isVerified: boolean;
    lastLoginAt?: Date;
    roles: RoleEnum[];
    deletedAt?: Date;
    deletedBy?: string;
    deleteReason?: string;
    user?: {
      fullName?: string;
      phone?: string;
    };
  }): AccountResponseDto {
    const dto = new AccountResponseDto();
    dto.id = account.id;
    dto.email = account.email;
    dto.isVerified = account.isVerified;
    dto.lastLoginAt = account.lastLoginAt;
    dto.fullName = account.user?.fullName;
    dto.phone = account.user?.phone;
    dto.roles = account.roles;
    dto.deletedAt = account.deletedAt;
    dto.deletedBy = account.deletedBy;
    dto.deleteReason = account.deleteReason;
    return dto;
  }

  static fromNullable(
    account:
      | Parameters<typeof AccountResponseDto.fromEntity>[0]
      | null
      | undefined,
  ): AccountResponseDto | null {
    return account ? AccountResponseDto.fromEntity(account) : null;
  }
}
