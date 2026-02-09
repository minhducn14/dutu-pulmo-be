import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '@/modules/core/auth/auth.service';
import { AuthController } from '@/modules/core/auth/auth.controller';
import { JwtStrategy } from '@/modules/core/auth/strategies/jwt.strategy';
import { JwtLogoutStrategy } from '@/modules/core/auth/strategies/jwt-logout.strategy';
import { User } from '@/modules/user/entities/user.entity';
import { Account } from '@/modules/account/entities/account.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from '@/modules/email/email.module';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { DoctorSchedule } from '@/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from '@/modules/doctor/entities/time-slot.entity';
import { RefreshToken } from '@/modules/core/auth/entities/refresh-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      User,
      Patient,
      Doctor,
      DoctorSchedule,
      TimeSlot,
      RefreshToken,
    ]),
    PassportModule,
    ConfigModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtLogoutStrategy],
  exports: [AuthService],
})
export class AuthModule {}
