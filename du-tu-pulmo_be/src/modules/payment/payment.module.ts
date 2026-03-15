import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentController } from '@/modules/payment/payment.controller';
import { PaymentService } from '@/modules/payment/payment.service';
import { PayosService } from '@/modules/payment/payos.service';
import { PaymentGateway } from '@/modules/payment/payment.gateway';
import { Payment } from '@/modules/payment/entities/payment.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { User } from '@/modules/user/entities/user.entity';
import { Account } from '@/modules/account/entities/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Appointment,
      Patient,
      Doctor,
      User,
      Account,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PayosService, PaymentGateway],
  exports: [PaymentService, PayosService, PaymentGateway],
})
export class PaymentModule {}
