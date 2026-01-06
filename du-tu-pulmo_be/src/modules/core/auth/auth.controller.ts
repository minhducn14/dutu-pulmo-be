import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RegisterResponseDto } from './dto/register-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordWithTokenDto } from './dto/reset-password-with-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RefreshTokenResponseDto } from './dto/refresh-token-response.dto';
import express from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtLogoutGuard } from './guards/jwt-logout.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import * as jwtStrategy from './strategies/jwt.strategy';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { ConfigService } from '@nestjs/config';

@ApiTags('Auth')
@Throttle({ default: { limit: 15, ttl: 60000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: RegisterResponseDto,
    description: 'Đăng ký thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email đã tồn tại hoặc dữ liệu không hợp lệ',
  })
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: LoginResponseDto,
    description: 'Đăng nhập thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Sai thông tin đăng nhập',
  })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiQuery({ name: 'code', description: 'Authorization code từ Google' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect sau khi xử lý Google OAuth',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Không có authorization code',
  })
  async googleAuthCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: express.Response,
  ) {
    if (error || !code) {
      return res.redirect(`${process.env.FRONTEND_URL}/signin?error=${error}`);
    }

    try {
      const result = await this.authService.handleGoogleLogin(code);

      // Encode toàn bộ object result thành base64 để truyền qua URL
      const encodedResult = Buffer.from(
        JSON.stringify(result),
        'utf-8', // Chỉ định encoding UTF-8 khi tạo Buffer
      ).toString('base64');

      return res.redirect(
        `${process.env.FRONTEND_URL}/login-success?data=${encodedResult}`,
      );
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      // Xử lý lỗi OAuth
      return res.redirect(
        `${process.env.FRONTEND_URL}/signin?error=oauth_failed`,
      );
    }
  }

  @Throttle({ default: { limit: 9, ttl: 300000 } }) // 9 requests/5 phút
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi email reset mật khẩu' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'Email đã được gửi (nếu tồn tại). Response luôn trả về success để bảo mật.',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.sendForgotPasswordEmail(dto.email);
  }

  @Throttle({ default: { limit: 9, ttl: 300000 } }) // 9 requests/5 phút
  @Post('reset-password-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset mật khẩu bằng token từ email' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ResetPasswordResponseDto,
    description: 'Reset mật khẩu thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token không hợp lệ hoặc đã hết hạn',
  })
  async resetPasswordWithToken(@Body() dto: ResetPasswordWithTokenDto) {
    return this.authService.resetPasswordWithToken(dto.token, dto.newPassword);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token bằng refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: RefreshTokenResponseDto,
    description: 'Làm mới token thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Refresh token không hợp lệ hoặc đã hết hạn',
  })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @UseGuards(JwtLogoutGuard)
  @ApiOperation({ summary: 'Đăng xuất và xóa refresh token' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Đăng xuất thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Token không hợp lệ',
  })
  async logout(@CurrentUser() user: jwtStrategy.JwtUser) {
    return this.authService.logout(user.id);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Xác thực email bằng token' })
  @ApiQuery({ name: 'token', description: 'Verification token from email' })
  @ApiResponse({
    status: HttpStatus.FOUND,
    description: 'Redirect to frontend with result',
  })
  async verifyEmail(
    @Query('token') token: string,
    @Res() res: express.Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    if (!token) {
      return res.redirect(
        `${frontendUrl}/verification-failed?reason=missing_token`,
      );
    }

    const result = await this.authService.verifyEmailByToken(token);

    switch (result.status) {
      case 'INVALID_TOKEN':
        return res.redirect(
          `${frontendUrl}/verification-failed?reason=invalid_token`,
        );

      case 'ALREADY_VERIFIED':
        return res.redirect(`${frontendUrl}/already-verified`);

      case 'EXPIRED_TOKEN':
        return res.redirect(
          `${frontendUrl}/verification-failed?reason=expired_token&email=${encodeURIComponent(
            result.email,
          )}`,
        );

      case 'SUCCESS':
        return res.redirect(`${frontendUrl}/verification-success`);

      default:
        return res.redirect(
          `${frontendUrl}/verification-failed?reason=server_error`,
        );
    }
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @ApiOperation({ summary: 'Gửi lại email xác thực' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email xác thực đã được gửi lại (nếu email tồn tại)',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email đã được xác thực hoặc dữ liệu không hợp lệ',
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<ResponseCommon<{ message: string }>> {
    const result = await this.authService.resendVerificationEmail(dto.email);

    if (result.status === 'ALREADY_VERIFIED') {
      throw new BadRequestException('Tài khoản đã được xác thực.');
    }

    return new ResponseCommon(200, 'SUCCESS', {
      message:
        result.status === 'SUCCESS'
          ? 'Email xác thực đã được gửi lại. Vui lòng kiểm tra hộp thư.'
          : 'Nếu email tồn tại, một email xác thực mới đã được gửi.',
    });
  }
}
