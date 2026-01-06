import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import AppDataSourcePromise from './modules/core/database/data-source';

// Configurations
import vnpayConfig from './config/vnpay.config';
import frontendConfig from './config/frontend.config';
import cloudinaryConfig from './config/cloudinary.config';
import * as Joi from 'joi';
import { ConfigModule } from '@nestjs/config';

// Core Modules
import { AuthModule } from './modules/core/auth/auth.module';

// Feature Modules
import { AccountModule } from './modules/account/account.module';
import { CloudinaryModule } from './modules/cloudinary/cloudinary.module';
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
      load: [vnpayConfig, frontendConfig, cloudinaryConfig],
      validationSchema: Joi.object({
        FRONTEND_URL: Joi.string().required().uri(),

        VNP_TMN_CODE: Joi.string().required(),
        VNP_HASH_SECRET: Joi.string().required(),
        VNP_URL: Joi.string().uri().required(),
        VNP_RETURN_URL: Joi.string().uri().required(),
        VNP_IPN_URL: Joi.string().uri().optional(),

        // Cloudinary configuration
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 phút
        limit: 1000, // 1000 requests per minute
      },
    ]),
    AuthModule,
    AccountModule,
    CloudinaryModule,
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
