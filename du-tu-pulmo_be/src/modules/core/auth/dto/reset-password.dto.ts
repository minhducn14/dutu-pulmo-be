import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Firebase ID Token từ xác thực OTP SMS',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiProperty({
    description: 'Mật khẩu mới',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
    message: 'Mật khẩu phải chứa chữ hoa, chữ thường, số và ký tự đặc biệt',
  })
  newPassword: string;
}
