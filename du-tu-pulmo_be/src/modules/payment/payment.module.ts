import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from '@/modules/payment/payment.controller';
import { PaymentService } from '@/modules/payment/payment.service';
import { PayosService } from '@/modules/payment/payos.service';
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
  ],
  controllers: [PaymentController],
  providers: [PaymentService, PayosService],
  exports: [PaymentService, PayosService],
})
export class PaymentModule {}
