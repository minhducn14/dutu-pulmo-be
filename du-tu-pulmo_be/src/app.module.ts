import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import AppDataSourcePromise from './modules/core/database/data-source';
import vnpayConfig from './config/vnpay.config';
import frontendConfig from './config/frontend.config';
import * as Joi from 'joi';
import { ConfigModule } from '@nestjs/config';

// Core Modules
import { AuthModule } from './modules/core/auth/auth.module';

// Feature Modules
import { AccountModule } from './modules/account/account.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { EmailModule } from './modules/email/email.module';
import { PatientModule } from './modules/patient/patient.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => (await AppDataSourcePromise).options,
    }),
   ConfigModule.forRoot({
      isGlobal: true,
      load: [vnpayConfig, frontendConfig],
      validationSchema: Joi.object({
        FRONTEND_URL: Joi.string().required().uri(),

        VNP_TMN_CODE: Joi.string().required(),
        VNP_HASH_SECRET: Joi.string().required(),
        VNP_URL: Joi.string().uri().required(),
        VNP_RETURN_URL: Joi.string().uri().required(),
        VNP_IPN_URL: Joi.string().uri().optional(), 

      }),
    }),
    AuthModule,
    AccountModule,
    DoctorModule,
    EmailModule,
    PatientModule,
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
