import { Controller, UseGuards } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
@ApiTags('Reviews')
@Controller('reviews')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

}
