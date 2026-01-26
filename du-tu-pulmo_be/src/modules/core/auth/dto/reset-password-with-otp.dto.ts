import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordWithOtpDto {
  @ApiProperty({
    description: 'Email của tài khoản cần reset mật khẩu',
  })
  @IsString()
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @ApiProperty({
    description: 'OTP reset mật khẩu',
  })
  @IsString()
  @IsNotEmpty({ message: 'OTP không được để trống' })
  otp: string;

  @ApiProperty({
    description: 'Mật khẩu mới',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  newPassword: string;
}
