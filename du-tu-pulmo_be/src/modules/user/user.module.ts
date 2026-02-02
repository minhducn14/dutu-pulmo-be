import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/user/entities/user.entity';
import { UserService } from '@/modules/user/user.service';
import { UserController } from '@/modules/user/user.controller';
import { Account } from '@/modules/account/entities/account.entity';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Patient } from '@/modules/patient/entities/patient.entity';
import { CloudinaryModule } from '../cloudinary';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Account, Doctor, Patient]),
    CloudinaryModule
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
