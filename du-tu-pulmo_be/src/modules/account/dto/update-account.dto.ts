import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsBoolean } from 'class-validator';

/**
 * For admin to update account roles
 */
export class AdminUpdateAccountDto {
  @ApiPropertyOptional({
    example: ['PATIENT', 'DOCTOR'],
    description: 'Danh sách vai trò (ADMIN only)',
  })
  @IsOptional()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({
    example: true,
    description: 'Trạng thái xác minh (ADMIN only)',
  })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

/**
 * For user to update their own profile (on User entity)
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: '0912345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
