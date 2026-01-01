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
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
