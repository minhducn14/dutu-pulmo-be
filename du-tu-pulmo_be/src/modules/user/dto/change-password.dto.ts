import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'Mật khẩu hiện tại',
    example: 'OldPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @ApiProperty({
    description: 'Mật khẩu mới',
    example: 'NewPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải chứa chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  newPassword: string;

  @ApiProperty({
    description: 'Xác nhận mật khẩu mới',
    example: 'NewPassword123!',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
