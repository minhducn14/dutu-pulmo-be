import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtLogoutStrategy } from './strategies/jwt-logout.strategy';
import { User } from '../../user/entities/user.entity';
import { Account } from '../../account/entities/account.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailModule } from 'src/modules/email/email.module';
import { Patient } from 'src/modules/patient/entities/patient.entity';
import { Doctor } from 'src/modules/doctor/entities/doctor.entity';
import { DoctorSchedule } from 'src/modules/doctor/entities/doctor-schedule.entity';
import { TimeSlot } from 'src/modules/doctor/entities/time-slot.entity';
import { RefreshToken } from './entities/refresh-token.entity';

@Module({
  imports: [
    // SEC-01: Added DoctorSchedule and TimeSlot for DoctorOwnershipGuard injection
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
