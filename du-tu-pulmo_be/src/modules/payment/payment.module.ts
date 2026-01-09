import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PayosService } from './payos.service';
import { Payment } from './entities/payment.entity';
import { Appointment } from '../appointment/entities/appointment.entity';
import { Patient } from '../patient/entities/patient.entity';
import { Doctor } from '../doctor/entities/doctor.entity';
import { User } from '../user/entities/user.entity';
import { Account } from '../account/entities/account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Payment,
      Appointment,
      Patient,
      Doctor,
      User,
      Account,])],
  controllers: [PaymentController],
  providers: [PaymentService, PayosService],
  exports: [PaymentService, PayosService],
})
export class PaymentModule {}
