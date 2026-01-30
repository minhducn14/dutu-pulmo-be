import { ApiProperty } from '@nestjs/swagger';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { UserStatusEnum } from '@/modules/common/enums/user-status.enum';

export class AuthUserResponseDto {
  @ApiProperty({ example: 'b7c1cf97-6734-43ae-9a62-0f97b48f5123' })
  id: string;

  @ApiProperty({ example: 'Nguyen Van A', required: false })
  fullName?: string;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  avatarUrl?: string;

  @ApiProperty({ enum: UserStatusEnum, required: false })
  status?: UserStatusEnum;

  @ApiProperty({ example: 'doctor-id', required: false })
  doctorId?: string;

  @ApiProperty({ example: 'patient-id', required: false })
  patientId?: string;

  static fromResult(data: {
    id: string;
    fullName?: string;
    avatarUrl?: string;
    status?: UserStatusEnum;
    doctorId?: string;
    patientId?: string;
  }): AuthUserResponseDto {
    const dto = new AuthUserResponseDto();
    dto.id = data.id;
    dto.fullName = data.fullName;
    dto.avatarUrl = data.avatarUrl;
    dto.status = data.status;
    dto.doctorId = data.doctorId;
    dto.patientId = data.patientId;
    return dto;
  }
}

export class AuthAccountResponseDto {
  @ApiProperty({ example: 'acc-id' })
  id: string;

  @ApiProperty({ example: 'user@email.com' })
  email: string;

  @ApiProperty({ isArray: true, enum: RoleEnum })
  roles: RoleEnum[];

  @ApiProperty({ example: true })
  isVerified: boolean;

  @ApiProperty({ type: AuthUserResponseDto })
  user: AuthUserResponseDto;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;

  static fromResult(data: {
    id: string;
    email: string;
    roles: RoleEnum[];
    isVerified: boolean;
    user: {
      id: string;
      fullName?: string;
      avatarUrl?: string;
      status?: UserStatusEnum;
      doctorId?: string;
      patientId?: string;
    };
    createdAt: Date;
    updatedAt: Date;
  }): AuthAccountResponseDto {
    const dto = new AuthAccountResponseDto();
    dto.id = data.id;
    dto.email = data.email;
    dto.roles = data.roles;
    dto.isVerified = data.isVerified;
    dto.user = AuthUserResponseDto.fromResult(data.user);
    dto.createdAt = data.createdAt;
    dto.updatedAt = data.updatedAt;
    return dto;
  }
}

export class LoginResponseDto {
  @ApiProperty({ description: 'Access token JWT' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token JWT' })
  refreshToken: string;

  @ApiProperty({ type: AuthAccountResponseDto })
  account: AuthAccountResponseDto;

  static fromResult(data: {
    accessToken: string;
    refreshToken: string;
    account: Parameters<typeof AuthAccountResponseDto.fromResult>[0];
  }): LoginResponseDto {
    const dto = new LoginResponseDto();
    dto.accessToken = data.accessToken;
    dto.refreshToken = data.refreshToken;
    dto.account = AuthAccountResponseDto.fromResult(data.account);
    return dto;
  }
}
