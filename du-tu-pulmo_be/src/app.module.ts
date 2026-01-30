import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import AppDataSourcePromise from './modules/core/database/data-source';

import { AppController } from './app.controller';
import { AppService } from './app.service';
// Core Modules
import { AuthModule } from './modules/core/auth/auth.module';

// Feature Modules
import { AccountModule } from './modules/account/account.module';
import { AdminActionModule } from './modules/admin-action/admin-action.module';
import { AppointmentModule } from './modules/appointment/appointment.module';
import { ChatModule } from './modules/chat/chat.module';
import { ChatMessageModule } from './modules/chatmessage/chatmessage.module';
import { ChatRoomModule } from './modules/chatroom/chatroom.module';
import { DoctorModule } from './modules/doctor/doctor.module';
import { EmailModule } from './modules/email/email.module';
import { FavoriteModule } from './modules/favorite/favorite.module';
import { HospitalModule } from './modules/hospital/hospital.module';
import { MedicalModule } from './modules/medical/medical.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PatientModule } from './modules/patient/patient.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReportModule } from './modules/report/report.module';
import { ReviewModule } from './modules/review/review.module';
import { ScreeningModule } from './modules/screening/screening.module';
import { SystemModule } from './modules/system/system.module';
import { UserModule } from './modules/user/user.module';
import { VideoCallModule } from './modules/video_call/video-call.module';
import { CloudinaryModule } from './modules/cloudinary';
import { EnumModule } from './modules/enum/enum.module';
import { CronModule } from './cron/cron.module';

// Configurations
import vnpayConfig from './config/vnpay.config';
import frontendConfig from './config/frontend.config';
import cloudinaryConfig from './config/cloudinary.config';
import payosConfig from './config/payos.config';

// Middleware
import * as Joi from 'joi';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => (await AppDataSourcePromise).options,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [vnpayConfig, frontendConfig, cloudinaryConfig, payosConfig],
      validationSchema: Joi.object({
        // Frontend validation
        FRONTEND_URL: Joi.string().required().uri(),

        // VNPAY validation
        VNP_TMN_CODE: Joi.string().required(),
        VNP_HASH_SECRET: Joi.string().required(),
        VNP_URL: Joi.string().uri().required(),
        VNP_RETURN_URL: Joi.string().uri().required(),
        VNP_IPN_URL: Joi.string().uri().optional(),

        // Cloudinary configuration
        CLOUDINARY_CLOUD_NAME: Joi.string().required(),
        CLOUDINARY_API_KEY: Joi.string().required(),
        CLOUDINARY_API_SECRET: Joi.string().required(),

        // Daily.co configuration for Video Call
        DAILY_API_KEY: Joi.string().optional(),

        // PayOS configuration for Payment
        PAYOS_CLIENT_ID: Joi.string().optional(),
        PAYOS_API_KEY: Joi.string().optional(),
        PAYOS_CHECKSUM_KEY: Joi.string().optional(),
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Core Module
    AuthModule,
    CronModule,

    // Feature Modules
    AccountModule,
    AdminActionModule,
    AppointmentModule,
    ChatModule,
    ChatMessageModule,
    ChatRoomModule,
    CloudinaryModule,
    DoctorModule,
    EmailModule,
    EnumModule,
    FavoriteModule,
    HospitalModule,
    MedicalModule,
    NotificationModule,
    PatientModule,
    PaymentModule,
    ReportModule,
    ReviewModule,
    ScreeningModule,
    SystemModule,
    UserModule,
    VideoCallModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
