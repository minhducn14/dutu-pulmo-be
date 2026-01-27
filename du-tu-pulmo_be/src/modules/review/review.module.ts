import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './entities/review.entity';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { Doctor } from '../doctor/entities/doctor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Doctor])],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService, TypeOrmModule],
})
export class ReviewModule {}
