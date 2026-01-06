import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @ApiProperty({ example: 'user@email.com', description: 'Email đăng ký' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(128, { message: 'Mật khẩu tối đa 128 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa, 1 chữ thường và 1 số',
  })
  @ApiProperty({
    example: 'SecurePass123',
    minLength: 8,
    description: 'Mật khẩu (ít nhất 8 ký tự, có chữ hoa, chữ thường và số)',
  })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ApiProperty({
    example: 'Nguyễn Văn A',
    required: false,
    description: 'Tên đầy đủ',
  })
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^0[1-9]\d{8}$/, {
    message: 'Số điện thoại không hợp lệ (VD: 0912345678)',
  })
  @ApiProperty({ example: '0912345678', required: false })
  phone?: string;
}
