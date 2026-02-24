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
import { AuthService } from '@/modules/core/auth/auth.service';
import { RegisterDto } from '@/modules/core/auth/dto/register.dto';
import { LoginDto } from '@/modules/core/auth/dto/login.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RegisterResponseDto } from '@/modules/core/auth/dto/register-response.dto';
import { LoginResponseDto } from '@/modules/core/auth/dto/login-response.dto';
import { ResetPasswordResponseDto } from '@/modules/core/auth/dto/reset-password-response.dto';
import { ForgotPasswordDto } from '@/modules/core/auth/dto/forgot-password.dto';
import { ResetPasswordWithTokenDto } from '@/modules/core/auth/dto/reset-password-with-token.dto';
import { RefreshTokenDto } from '@/modules/core/auth/dto/refresh-token.dto';
import { ResendVerificationDto } from '@/modules/core/auth/dto/resend-verification.dto';
import { RefreshTokenResponseDto } from '@/modules/core/auth/dto/refresh-token-response.dto';
import express from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtLogoutGuard } from '@/modules/core/auth/guards/jwt-logout.guard';
import { UseGuards } from '@nestjs/common';
import { CurrentUser } from '@/common/decorators/user.decorator';
import * as jwtStrategy from '@/modules/core/auth/strategies/jwt.strategy';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ConfigService } from '@nestjs/config';
import { VerifyOtpDto } from '@/modules/core/auth/dto/verify-otp.dto';
import { AuthMessageResponseDto } from '@/modules/core/auth/dto/auth-message-response.dto';
import { ResetPasswordWithOtpDto } from '@/modules/core/auth/dto/reset-password-with-otp.dto';

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
  async register(
    @Body() dto: RegisterDto,
  ): Promise<ResponseCommon<RegisterResponseDto>> {
    const response = await this.authService.register(dto);
    return new ResponseCommon(response.code, response.message, {
      message: response.data?.message ?? '',
    });
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
  async login(
    @Body() dto: LoginDto,
  ): Promise<ResponseCommon<LoginResponseDto>> {
    const response = await this.authService.login(dto);
    if (!response.data) {
      throw new BadRequestException('Login response is empty');
    }
    return new ResponseCommon(
      response.code,
      response.message,
      LoginResponseDto.fromResult(response.data),
    );
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
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ResponseCommon<AuthMessageResponseDto>> {
    const response = await this.authService.sendForgotPasswordEmail(dto.email);
    return new ResponseCommon(response.code, response.message, {
      message: response.data?.message ?? '',
    });
  }

  @Throttle({ default: { limit: 9, ttl: 300000 } })
  @Post('forgot-password-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi OTP reset mật khẩu' })
  @ApiResponse({
    status: HttpStatus.OK,
    description:
      'OTP đã được gửi (nếu tồn tại). Response luôn trả về success để bảo mật.',
  })
  async forgotPasswordOtp(
    @Body() dto: ForgotPasswordDto,
  ): Promise<ResponseCommon<AuthMessageResponseDto>> {
    const response = await this.authService.sendForgotPasswordOtp(dto.email);
    return new ResponseCommon(response.code, response.message, {
      message: response.data?.message ?? '',
    });
  }

  @Throttle({ default: { limit: 9, ttl: 300000 } })
  @Post('reset-password-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset mật khẩu bằng OTP' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: ResetPasswordResponseDto,
    description: 'Reset mật khẩu thành công',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'OTP không hợp lệ hoặc đã hết hạn',
  })
  async resetPasswordWithOtp(
    @Body() dto: ResetPasswordWithOtpDto,
  ): Promise<ResponseCommon<ResetPasswordResponseDto>> {
    const response = await this.authService.resetPasswordWithOtp(
      dto.email,
      dto.otp,
      dto.newPassword,
    );
    return new ResponseCommon(response.code, response.message, {
      message: response.data?.message ?? '',
    });
  }

  @Throttle({ default: { limit: 9, ttl: 300000 } })
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
  async resetPasswordWithToken(
    @Body() dto: ResetPasswordWithTokenDto,
  ): Promise<ResponseCommon<ResetPasswordResponseDto>> {
    const response = await this.authService.resetPasswordWithToken(
      dto.token,
      dto.newPassword,
    );
    return new ResponseCommon(response.code, response.message, {
      message: response.data?.message ?? '',
    });
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
  async refreshToken(
    @Body() dto: RefreshTokenDto,
  ): Promise<ResponseCommon<RefreshTokenResponseDto>> {
    const response = await this.authService.refreshAccessToken(
      dto.refreshToken,
    );
    if (!response.data?.accessToken) {
      throw new BadRequestException('Refresh token response is empty');
    }
    return new ResponseCommon(response.code, response.message, {
      accessToken: response.data.accessToken,
      refreshToken: response.data?.refreshToken,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
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
  async logout(
    @CurrentUser() user: jwtStrategy.JwtUser,
  ): Promise<ResponseCommon<AuthMessageResponseDto>> {
    const response = await this.authService.logout(user.id);
    return new ResponseCommon(response.code, response.message, {
      message: response.data?.message ?? '',
    });
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
  ): Promise<ResponseCommon<AuthMessageResponseDto>> {
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

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác thực email bằng mã OTP' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xác thực thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Mã OTP không hợp lệ hoặc đã hết hạn',
  })
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
  ): Promise<ResponseCommon<AuthMessageResponseDto>> {
    const result = await this.authService.verifyEmailByOtp(dto.email, dto.otp);

    switch (result.status) {
      case 'INVALID_OTP':
        throw new BadRequestException('Mã OTP không hợp lệ');

      case 'ALREADY_VERIFIED':
        throw new BadRequestException('Tài khoản đã được xác thực');

      case 'EXPIRED_OTP':
        throw new BadRequestException(
          'Mã OTP đã hết hạn. Vui lòng yêu cầu gửi lại mã mới',
        );

      case 'SUCCESS':
        return new ResponseCommon(200, 'SUCCESS', {
          message: 'Xác thực tài khoản thành công!',
        });

      default:
        throw new BadRequestException('Đã có lỗi xảy ra. Vui lòng thử lại');
    }
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi lại mã OTP xác thực' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Mã OTP đã được gửi lại',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Email đã được xác thực hoặc yêu cầu quá nhanh',
  })
  async resendOtp(
    @Body() dto: ResendVerificationDto,
  ): Promise<ResponseCommon<AuthMessageResponseDto>> {
    const result = await this.authService.resendVerificationOtp(dto.email);

    switch (result.status) {
      case 'ALREADY_VERIFIED':
        throw new BadRequestException('Tài khoản đã được xác thực');

      case 'RATE_LIMITED':
        throw new BadRequestException(
          'Vui lòng đợi ít nhất 1 phút trước khi yêu cầu gửi lại mã OTP',
        );

      case 'SUCCESS':
        return new ResponseCommon(200, 'SUCCESS', {
          message: 'Mã OTP mới đã được gửi đến email của bạn',
        });

      default:
        return new ResponseCommon(200, 'SUCCESS', {
          message: 'Nếu email tồn tại, mã OTP mới đã được gửi',
        });
    }
  }
}
