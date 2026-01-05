/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Account } from '../../account/entities/account.entity';
import { User } from '../../user/entities/user.entity';
import { Patient } from '../../patient/entities/patient.entity';
import { Doctor } from '../../doctor/entities/doctor.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RoleEnum } from '../../common/enums/role.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';
import { Logger } from '@nestjs/common';
import { vnNow } from 'src/common/datetime';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { EmailService } from 'src/modules/email/email.service';
import { AUTH_ERRORS } from 'src/common/constants/error-messages.constant';
import * as crypto from 'crypto';
import { VerifyEmailResult, ResendVerificationResult } from './auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Doctor)
    private readonly doctorRepo: Repository<Doctor>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    const maskedLocal =
      local.length > 2 ? local[0] + '***' + local[local.length - 1] : '***';
    return `${maskedLocal}@${domain}`;
  }


  private maskPhone(phone: string): string {
    if (phone.length < 6) return '***';
    return phone.slice(0, 3) + '***' + phone.slice(-4);
  }

  async register(
    dto: RegisterDto,
  ): Promise<ResponseCommon<{ message: string }>> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Validate Vietnamese phone number format
    if (dto.phone) {
      const vietnamesePhoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
      if (!vietnamesePhoneRegex.test(dto.phone)) {
        throw new BadRequestException(
          'Số điện thoại không hợp lệ. Vui lòng nhập số điện thoại Việt Nam (VD: 0912345678 hoặc +84912345678)',
        );
      }
    }

    // Validate full name
    if (!dto.fullName || dto.fullName.trim().length < 2) {
      throw new BadRequestException('Họ tên phải có ít nhất 2 ký tự');
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(dto.password)) {
      throw new BadRequestException(
        'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt',
      );
    }

    // ✅ Use transaction for data consistency
    return await this.dataSource.transaction(async (manager) => {
      // Check email existence with pessimistic lock
      const qb = manager
        .getRepository(Account)
        .createQueryBuilder('a')
        .where('a.email = :email', { email: normalizedEmail });

      if (dto.phone) {
        qb.orWhere(`
          EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = a.user_id
            AND u.phone = :phone
          )
        `, { phone: dto.phone });
      }

      const exist = await qb
        .setLock('pessimistic_write')
        .getOne();

      if (exist) {
        throw new ConflictException(AUTH_ERRORS.EMAIL_ALREADY_REGISTERED);
      }

      // Hash password
      const hash = await bcrypt.hash(dto.password, 12);

      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user
      const user = manager.create(User, {
        email: normalizedEmail,
        phone: dto.phone,
        fullName: dto.fullName,
      });
      await manager.save(user);

      // Create patient entity for PATIENT role
      const patient = manager.create(Patient, {
        userId: user.id,
        user: user,
      });
      await manager.save(patient);

      // Create account with verification token
      const account = manager.create(Account, {
        email: normalizedEmail,
        password: hash,
        isVerified: false,
        verificationToken,
        verificationExpiry,
        roles: [RoleEnum.PATIENT],
        user: user,
      });
      await manager.save(account);

      this.emailService
        .sendVerificationEmail(normalizedEmail, verificationToken, dto.fullName!)
        .catch((error) => {
          this.logger.error(
            `Failed to send verification email to ${this.maskEmail(normalizedEmail)}`,
            error,
          );
        });

      this.logger.log(`User registered: ${this.maskEmail(normalizedEmail)}`);

      return new ResponseCommon(200, 'SUCCESS', {
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
      });
    });
  }

  async verifyEmailByToken(token: string): Promise<VerifyEmailResult> {
    try {
      // Optional but recommended: transaction để update account + user cùng lúc
      return await this.dataSource.transaction(async (manager) => {
        const accountRepo = manager.getRepository(Account);
        const userRepo = manager.getRepository(User);

        const account = await accountRepo
          .createQueryBuilder('acc')
          .leftJoinAndSelect('acc.user', 'user')
          .addSelect('acc.verificationToken')
          .where('acc.verificationToken = :token', { token })
          .getOne();

        if (!account) return { status: 'INVALID_TOKEN' };

        if (account.isVerified) return { status: 'ALREADY_VERIFIED' };

        if (
          account.verificationExpiry &&
          account.verificationExpiry < new Date()
        ) {
          return { status: 'EXPIRED_TOKEN', email: account.email };
        }

        // Update account
        account.isVerified = true;
        account.verificationToken = null; 
        account.verificationExpiry = null;
        account.verifiedAt = new Date();
        await accountRepo.save(account);

        // Fire-and-forget welcome email (không làm fail transaction)
        this.emailService
          .sendWelcomeEmail(account.email, account.user?.fullName ?? '')
          .catch((err) => this.logger.error('Failed to send welcome email', err));

        return { status: 'SUCCESS' };
      });
    } catch (err) {
      this.logger.error('Email verification error', err);
      return { status: 'SERVER_ERROR' };
    }
  }

  async login(
    dto: LoginDto,
  ): Promise<
    ResponseCommon<{ accessToken: string; refreshToken: string; account: any }>
  > {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const acc = await this.accountRepo
    .createQueryBuilder('acc')
    .leftJoinAndSelect('acc.user', 'user')
    .addSelect('acc.password') 
    .where('acc.email = :email', { email: normalizedEmail })
    .getOne();

    if (!acc) {
      this.logger.debug(`Login attempt for non-existent email: ${this.maskEmail(normalizedEmail)}`);
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    if (!(await bcrypt.compare(dto.password, acc.password))) {
      this.logger.debug(`Invalid password for email: ${this.maskEmail(normalizedEmail)}`);
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    if (!acc.isVerified) {
      this.logger.debug(`Email not verified for email: ${this.maskEmail(normalizedEmail)}`);
      throw new UnauthorizedException(
        AUTH_ERRORS.EMAIL_NOT_VERIFIED,
      );
    }

    if (acc.deletedAt) {
      this.logger.debug(`Account deleted for email: ${this.maskEmail(normalizedEmail)}`);
      throw new UnauthorizedException(
        AUTH_ERRORS.ACCOUNT_DELETED,
      );
    }

    let patientId: string | undefined;
    let doctorId: string | undefined;

    if (acc.roles.includes(RoleEnum.PATIENT)) {
      const patient = await this.patientRepo.findOne({
        where: { userId: acc.user.id },
      });
      patientId = patient?.id;
    }
    if (acc.roles.includes(RoleEnum.DOCTOR)) {
      const doctor = await this.doctorRepo.findOne({
        where: { userId: acc.user.id },
      });
      doctorId = doctor?.id;
    }

    const payload = {
      sub: acc.id,              // accountId for auth
      accountId: acc.id,        // explicit for clarity
      userId: acc.user.id,      // user entity id for data ownership
      email: acc.email,
      roles: acc.roles,
      fullName: acc.user.fullName,
      patientId,
      doctorId,
    };

    const tokenJti = `rt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const accessToken = this.jwtService.sign(payload, { 
      expiresIn: '1d',
      jwtid: `at_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    });

    const refreshToken = this.jwtService.sign(
      { 
        sub: acc.id,
        userId: acc.user.id,
        email: acc.email, 
        type: 'refresh',
        jti: tokenJti,
      },
      { expiresIn: '7d' },
    );

    // Save refresh token to separate table
    const refreshTokenEntity = this.refreshTokenRepo.create({
      token: refreshToken,
      accountId: acc.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    await this.refreshTokenRepo.save(refreshTokenEntity);

    // Update last login
    acc.lastLoginAt = vnNow();
    await this.accountRepo.save(acc);

    return new ResponseCommon(200, 'SUCCESS', {
      accessToken,
      refreshToken,
      account: {
        id: acc.id,
        email: acc.email,
        roles: acc.roles,
        isVerified: acc.isVerified,
        user: {
          id: acc.user.id,
          fullName: acc.user.fullName,
          avatarUrl: acc.user.avatarUrl,
          status: acc.user.status,
        },
        createdAt: acc.user.createdAt,
        updatedAt: acc.user.updatedAt,
      },
    });
  }

  async handleGoogleLogin(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    account: any;
    accountStatus: 'new' | 'existing';
  }> {
    try {
      // Đổi code lấy token
      const tokenResponse = await axios.post(
        'https://oauth2.googleapis.com/token',
        {
          code,
          client_id: this.configService.get<string>('GOOGLE_CLIENT_ID'),
          client_secret: this.configService.get<string>('GOOGLE_CLIENT_SECRET'),
          redirect_uri: this.configService.get<string>('GOOGLE_REDIRECT_URI'),
          grant_type: 'authorization_code',
        },
      );

      const { access_token } = tokenResponse.data as { access_token: string };

      // Lấy thông tin người dùng từ Google
      const userInfoResponse = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${access_token}` },
        },
      );

      const { email, name, picture } = userInfoResponse.data as {
        email: string;
        name: string;
        picture?: string;
      };

      // Xử lý trong hệ thống
      const result = await this.findOrCreateGoogleUser(email, name, picture);

      // Lookup patientId and doctorId (giống login thường)
      let patientId: string | undefined;
      let doctorId: string | undefined;

      if (result.account.roles.includes(RoleEnum.PATIENT)) {
        const patient = await this.patientRepo.findOne({
          where: { userId: result.user.id },
        });
        patientId = patient?.id;
      }
      if (result.account.roles.includes(RoleEnum.DOCTOR)) {
        const doctor = await this.doctorRepo.findOne({
          where: { userId: result.user.id },
        });
        doctorId = doctor?.id;
      }

      // Sinh JWT (đồng nhất với login thường)
      const payload = {
        sub: result.account.id,              // accountId for auth
        accountId: result.account.id,        // explicit for clarity
        userId: result.user.id,              // user entity id for data ownership
        email: result.account.email,
        roles: result.account.roles,
        fullName: result.user.fullName,
        patientId,
        doctorId,
      };

      const tokenJti = `rt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Generate access token (1d giống login thường)
      const accessToken = this.jwtService.sign(payload, { 
        expiresIn: '1d',
        jwtid: `at_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      });

      // Generate refresh token (7 days)
      const refreshToken = this.jwtService.sign(
        { 
          sub: result.account.id,
          userId: result.user.id,
          email: result.account.email, 
          type: 'refresh',
          jti: tokenJti,
        },
        { expiresIn: '7d' },
      );

      // Save refresh token to separate table
      const refreshTokenEntity = this.refreshTokenRepo.create({
        token: refreshToken,
        accountId: result.account.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });
      await this.refreshTokenRepo.save(refreshTokenEntity);

      // Update last login
      result.account.lastLoginAt = vnNow();
      await this.accountRepo.save(result.account);

      return {
        accessToken,
        refreshToken,
        account: {
          id: result.account.id,
          email: result.account.email,
          roles: result.account.roles,
          isVerified: result.account.isVerified,
          user: {
            id: result.user.id,
            fullName: result.user.fullName,
            avatarUrl: result.user.avatarUrl,
            status: result.user.status,
            CCCD: result.user.CCCD,
            phone: result.user.phone,
          },
          createdAt: result.user.createdAt,
          updatedAt: result.user.updatedAt,
        },
        accountStatus: result.isNew ? 'new' : 'existing',
      };
    } catch (error) {
      this.logger.error('Google OAuth error:', error);
      throw new UnauthorizedException(AUTH_ERRORS.GOOGLE_AUTH_FAILED);
    }
  }

  private async findOrCreateGoogleUser(
    email: string,
    name: string,
    picture?: string,
  ): Promise<{ account: Account; user: User; isNew: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Kiểm tra user đã tồn tại chưa
    const existingAccount = await this.accountRepo.findOne({
      where: { email: normalizedEmail },
      relations: ['user'],
    });

    if (existingAccount) {
      // User đã tồn tại - cập nhật avatar nếu có
      if (picture && existingAccount.user && !existingAccount.user.avatarUrl) {
        existingAccount.user.avatarUrl = picture;
        await this.userRepo.save(existingAccount.user);
      }
      return { account: existingAccount, user: existingAccount.user, isNew: false };
    }

    // Tạo mới với transaction để đảm bảo data consistency
    return await this.dataSource.transaction(async (manager) => {
      // Double check với pessimistic lock
      const exist = await manager.findOne(Account, {
        where: { email: normalizedEmail },
        lock: { mode: 'pessimistic_write' },
      });

      if (exist) {
        // Race condition - account đã được tạo bởi request khác
        const existWithUser = await manager.findOne(Account, {
          where: { email: normalizedEmail },
          relations: ['user'],
        });
        return { account: existWithUser!, user: existWithUser!.user, isNew: false };
      }

      // Tạo user mới
      const user = manager.create(User, {
        email: normalizedEmail,
        fullName: name,
        avatarUrl: picture,
      });
      await manager.save(user);

      // Create patient entity for new Google OAuth user
      const patient = manager.create(Patient, {
        userId: user.id,
        user: user,
      });
      await manager.save(patient);

      const defaultRole = RoleEnum.PATIENT;
      // Tạo password random cho Google OAuth user (họ sẽ không dùng password này)
      const randomPassword = await bcrypt.hash(`google_oauth_${Date.now()}`, 12);

      const account = manager.create(Account, {
        email: normalizedEmail,
        password: randomPassword,
        isVerified: true, // Email đã được Google verify
        verifiedAt: new Date(),
        roles: [defaultRole],
        user: user,
      });
      await manager.save(account);

      this.logger.log(`Google OAuth user registered: ${this.maskEmail(normalizedEmail)}`);

      return { account, user, isNew: true };
    });
  }


  /**
   * Send forgot password email with reset token
   */
  async sendForgotPasswordEmail(
    email: string,
  ): Promise<ResponseCommon<{ message: string }>> {
    try {
      // Step 1: Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        // Return generic message for security
        return new ResponseCommon(200, 'SUCCESS', {
          message:
            'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
        });
      }

      // Step 2: Normalize email (lowercase, trim)
      const normalizedEmail = email.toLowerCase().trim();

      // Step 3: Find account by email
      const account = await this.accountRepo.findOne({
        where: { email: normalizedEmail },
        relations: ['user'],
      });

      if (!account) {
        // Security: Don't reveal if email exists or not
        // Still return success to prevent user enumeration
        return new ResponseCommon(200, 'SUCCESS', {
          message:
            'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
        });
      }

      // Step 4: Validate account has associated user
      if (!account.user) {
        this.logger.warn(
          `Account ${account.id} has no associated user. Skipping email.`,
        );
        return new ResponseCommon(200, 'SUCCESS', {
          message:
            'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
        });
      }

      // Step 5: Check if there's already a recent token (rate limiting)
      // Prevent spam by checking if token was generated recently
      if (account.resetPasswordToken) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const existingToken = this.jwtService.decode(
            account.resetPasswordToken,
          );
          
          if (existingToken?.timestamp) {
            const tokenAge = Date.now() - (existingToken.timestamp as number);
            const minTokenAge = 60000; // 1 minute cooldown

            if (tokenAge < minTokenAge) {
              this.logger.warn(
                `Rate limit: Reset email already sent recently for ${normalizedEmail}`,
              );
              return new ResponseCommon(200, 'SUCCESS', {
                message:
                  'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
              });
            }
          }
        } catch {
          // Invalid or expired token, proceed with new one
        }
      }

      // Step 6: Generate reset token (JWT with 1 hour expiry)
      const resetToken = this.jwtService.sign(
        {
          email: account.email,
          type: 'reset-password',
          timestamp: Date.now(),
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '1h', // Token expires in 1 hour
        },
      );

      // Step 7: Save reset token to database (overwrites old token)
      account.resetPasswordToken = resetToken;
      await this.accountRepo.save(account);

      // Step 8: Send email with token
      await this.emailService.sendResetPasswordEmail(
        normalizedEmail,
        resetToken,
        account.user.fullName,
      );

      this.logger.log(`Reset password email sent to: ${normalizedEmail}`);

      return new ResponseCommon(200, 'SUCCESS', {
        message:
          'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
      });
    } catch (error) {
      this.logger.error('Send forgot password email error:', error);
      // Return generic error, don't expose details
      return new ResponseCommon(200, 'SUCCESS', {
        message:
          'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được link reset mật khẩu.',
      });
    }
  }

  /**
   * Reset password using token from email
   */
  async resetPasswordWithToken(
    token: string,
    newPassword: string,
  ): Promise<ResponseCommon<{ message: string }>> {
    try {
      // Step 1: Verify JWT signature and expiry
      const decoded = this.jwtService.verify<{
        email: string;
        type?: string;
        timestamp?: number;
        [key: string]: unknown;
      }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Step 2: Validate token type
      if (decoded.type !== 'reset-password') {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN_TYPE);
      }

      // Step 3: Validate email exists in decoded token
      if (!decoded.email) {
        throw new UnauthorizedException(AUTH_ERRORS.TOKEN_MISSING_EMAIL);
      }

      // Step 4: Find account by email first
      const account = await this.accountRepo
        .createQueryBuilder('a')
        .addSelect('a.resetPasswordToken')
        .where('a.resetPasswordToken = :token', { token })
        .andWhere('a.deletedAt IS NULL')
        .getOne();

      if (!account) {
        throw new UnauthorizedException(AUTH_ERRORS.ACCOUNT_NOT_FOUND);
      }

      console.log(account);

      // Step 5: CRITICAL - Validate token matches the one in database
      if (!account.resetPasswordToken) {
        throw new UnauthorizedException(AUTH_ERRORS.TOKEN_ALREADY_USED);
      }

      // Step 6: CRITICAL - Token in DB must exactly match the provided token
      if (account.resetPasswordToken !== token) {
        throw new UnauthorizedException(AUTH_ERRORS.TOKEN_MISMATCH);
      }

      // Step 7: Additional security - Verify token timestamp is within reasonable time
      const tokenAge = Date.now() - (decoded.timestamp || 0);
      const oneHourInMs = 3600000;
      if (tokenAge > oneHourInMs) {
        // Extra check beyond JWT expiry
        account.resetPasswordToken = null;
        await this.accountRepo.save(account);
        throw new UnauthorizedException(AUTH_ERRORS.TOKEN_EXPIRED);
      }

      // Step 8: Hash new password with bcrypt
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Step 9: Update password and CLEAR token (single-use token)
      account.password = hashedPassword;
      account.resetPasswordToken = null;
      await this.accountRepo.save(account);

      this.logger.log(
        `Password reset successful via email for: ${account.email}`,
      );

      return new ResponseCommon(200, 'SUCCESS', {
        message: 'Đặt lại mật khẩu thành công!',
      });
    } catch (error) {
      this.logger.error('Reset password with token error:', error);
      if (
        error instanceof UnauthorizedException ||
        error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);
      }
      throw error;
    }
  }


  async refreshAccessToken(
    refreshToken: string,
  ): Promise<ResponseCommon<{ accessToken: string; refreshToken: string }>> {
    try {
      // Step 1: Verify JWT signature and expiry
      const decoded = this.jwtService.verify<{
        sub: string;
        userId?: string;
        email: string;
        type?: string;
        jti?: string;
        [key: string]: unknown;
      }>(refreshToken, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      // Step 2: Validate token type
      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN_TYPE);
      }

      // Step 3: Validate required fields
      if (!decoded.email || !decoded.sub) {
        throw new UnauthorizedException(AUTH_ERRORS.TOKEN_MISSING_CREDENTIALS);
      }

      // Step 4: Find the refresh token in database
      const existingToken = await this.refreshTokenRepo.findOne({
        where: { token: refreshToken, accountId: decoded.sub },
      });

      if (!existingToken) {
        this.logger.warn(
          `Refresh token not found for account: ${this.maskEmail(decoded.email)}`,
        );
        throw new UnauthorizedException(AUTH_ERRORS.REFRESH_TOKEN_MISMATCH);
      }

      // Step 5: Check if token is revoked
      if (existingToken.isRevoked) {
        this.logger.warn(
          `Attempted to use revoked refresh token for: ${this.maskEmail(decoded.email)}`,
        );
        // Possible token theft - revoke all tokens for this account
        await this.refreshTokenRepo.update(
          { accountId: decoded.sub, isRevoked: false },
          { isRevoked: true, revokedAt: new Date(), revokedReason: 'security_breach' },
        );
        throw new UnauthorizedException(AUTH_ERRORS.TOKEN_REVOKED);
      }

      // Step 6: Check if token is expired
      if (existingToken.expiresAt < new Date()) {
        throw new UnauthorizedException(AUTH_ERRORS.TOKEN_EXPIRED);
      }

      // Step 7: Find account to get user data
      const account = await this.accountRepo.findOne({
        where: { id: decoded.sub },
        relations: ['user'],
      });

      if (!account) {
        throw new UnauthorizedException(AUTH_ERRORS.ACCOUNT_NOT_FOUND);
      }

      // Lookup patientId and doctorId
      let patientId: string | undefined;
      let doctorId: string | undefined;

      if (account.roles.includes(RoleEnum.PATIENT)) {
        const patient = await this.patientRepo.findOne({
          where: { userId: account.user.id },
        });
        patientId = patient?.id;
      }
      if (account.roles.includes(RoleEnum.DOCTOR)) {
        const doctor = await this.doctorRepo.findOne({
          where: { userId: account.user.id },
        });
        doctorId = doctor?.id;
      }

      const payload = {
        sub: account.id,
        accountId: account.id,
        userId: account.user.id,
        email: account.email,
        roles: account.roles,
        fullName: account.user.fullName,
        patientId,
        doctorId,
      };

      const tokenJti = `rt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const newAccessToken = this.jwtService.sign(payload, {
        expiresIn: '1d',
        jwtid: `at_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      });

      // Generate new refresh token (Token Rotation)
      const newRefreshToken = this.jwtService.sign(
        {
          sub: account.id,
          userId: account.user.id,
          email: account.email,
          type: 'refresh',
          jti: tokenJti,
        },
        { expiresIn: '7d' },
      );

      // Step 8: Create new token and mark old as rotated
      const newTokenEntity = this.refreshTokenRepo.create({
        token: newRefreshToken,
        accountId: account.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      await this.refreshTokenRepo.save(newTokenEntity);

      // Mark old token as revoked (rotated)
      existingToken.isRevoked = true;
      existingToken.revokedAt = new Date();
      existingToken.revokedReason = 'rotated';
      existingToken.replacedByTokenId = newTokenEntity.id;
      existingToken.lastUsedAt = new Date();
      await this.refreshTokenRepo.save(existingToken);

      this.logger.debug(
        `Access token refreshed for: ${this.maskEmail(account.email)}`,
      );

      return new ResponseCommon(200, 'SUCCESS', {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      this.logger.error('Refresh token error:', error);
      if (
        error instanceof UnauthorizedException ||
        (error as any).name === 'JsonWebTokenError' ||
        (error as any).name === 'TokenExpiredError'
      ) {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);
      }
      throw error;
    }
  }

  /**
   * Logout - revoke all refresh tokens for the account
   */
  async logout(userId: string): Promise<ResponseCommon<{ message: string }>> {
    try {
      // Find account by user ID
      const account = await this.accountRepo.findOne({
        where: { user: { id: userId } },
        relations: ['user'],
      });

      if (!account) {
        throw new NotFoundException(AUTH_ERRORS.ACCOUNT_NOT_FOUND);
      }

      // Revoke all refresh tokens for this account
      await this.refreshTokenRepo.update(
        { accountId: account.id, isRevoked: false },
        { isRevoked: true, revokedAt: new Date(), revokedReason: 'logout' },
      );

      this.logger.log(`User logged out: ${account.email}`);

      return new ResponseCommon(200, 'SUCCESS', {
        message: 'Đăng xuất thành công!',
      });
    } catch (error) {
      this.logger.error('Logout error:', error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new UnauthorizedException(AUTH_ERRORS.LOGOUT_FAILED);
    }
  }

  async resendVerificationEmail(email: string): Promise<ResendVerificationResult> {
    const normalizedEmail = email.toLowerCase().trim();

    try {
      // Transaction optional; ở đây update account là chính
      return await this.dataSource.transaction(async (manager) => {
        const accountRepo = manager.getRepository(Account);

        const account = await accountRepo.findOne({
          where: { email: normalizedEmail },
          relations: ['user'],
        });

        // Không lộ email tồn tại hay không => trả status để controller map message chung
        if (!account) {
          this.logger.debug(
            `Resend verification attempted for non-existent email: ${normalizedEmail}`,
          );
          return { status: 'EMAIL_NOT_FOUND' };
        }

        if (account.isVerified) return { status: 'ALREADY_VERIFIED' };

        // Generate new token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        account.verificationToken = verificationToken;
        account.verificationExpiry = verificationExpiry;

        await accountRepo.save(account);

        await this.emailService.resendVerificationEmail(
          normalizedEmail,
          verificationToken,
          account.user?.fullName ?? '',
        );

        this.logger.log(`Verification email resent to: ${normalizedEmail}`);
        return { status: 'SUCCESS' };
      });
    } catch (err) {
      this.logger.error('Resend verification error', err);
      return { status: 'SERVER_ERROR' };
    }
  }
}
