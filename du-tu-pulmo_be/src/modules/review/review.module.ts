import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from '@/modules/review/entities/review.entity';
import { ReviewService } from '@/modules/review/review.service';
import { ReviewController } from '@/modules/review/review.controller';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';

import { NotificationModule } from '@/modules/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, Doctor, Appointment]),
    NotificationModule,
  ],

  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService, TypeOrmModule],
})
export class ReviewModule {}
