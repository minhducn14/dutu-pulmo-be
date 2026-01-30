import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from '@/modules/review/entities/review.entity';
import { ReviewService } from '@/modules/review/review.service';
import { ReviewController } from '@/modules/review/review.controller';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Doctor])],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService, TypeOrmModule],
})
export class ReviewModule {}
