import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '@/modules/review/entities/review.entity';
import { CreateReviewDto } from '@/modules/review/dto/create-review.dto';
import { UpdateReviewDto } from '@/modules/review/dto/update-review.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { ReviewResponseDto } from '@/modules/review/dto/review-response.dto';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
  ) {}

  async create(
    createReviewDto: CreateReviewDto,
    reviewerId: string,
  ): Promise<ResponseCommon<Review>> {
    const { doctorId, appointmentId, comment, rating, isAnonymous } =
      createReviewDto;

    // Check if already reviewed this appointment
    if (appointmentId) {
      const existingReview = await this.reviewRepository.findOne({
        where: { reviewerId, appointmentId },
      });
      if (existingReview) {
        throw new BadRequestException(ERROR_MESSAGES.REVIEW_ALREADY_EXISTS);
      }
    }

    const review = this.reviewRepository.create({
      reviewerId,
      doctorId,
      appointmentId,
      comment,
      rating,
      isAnonymous: isAnonymous || false,
    });

    const saved = await this.reviewRepository.save(review);

    // Update doctor's average rating
    await this.updateDoctorRating(doctorId);

    return new ResponseCommon(201, 'Đánh giá thành công', saved);
  }

  async findAll(): Promise<ResponseCommon<Review[]>> {
    const reviews = await this.reviewRepository.find({
      relations: ['reviewer', 'doctor', 'appointment'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', reviews);
  }

  async findAllByDoctorId(
    doctorId: string,
  ): Promise<
    ResponseCommon<Parameters<typeof ReviewResponseDto.fromEntity>[0][]>
  > {
    const reviews = await this.reviewRepository.find({
      where: { doctorId },
      relations: ['reviewer', 'appointment'],
      order: { createdAt: 'DESC' },
    });

    // Hide reviewer info for anonymous reviews
    const processedReviews = reviews.map((review) => {
      if (!review.isAnonymous) {
        return review;
      }

      return {
        id: review.id,
        reviewerId: null,
        doctorId: review.doctorId,
        appointmentId: review.appointmentId ?? null,
        comment: review.comment,
        rating: review.rating,
        doctorResponse: review.doctorResponse ?? null,
        responseAt: review.responseAt ?? null,
        isAnonymous: review.isAnonymous,
        createdAt: review.createdAt,
      };
    });

    return new ResponseCommon(200, 'SUCCESS', processedReviews);
  }

  async findOne(id: string): Promise<ResponseCommon<Review>> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['reviewer', 'doctor', 'appointment'],
    });
    if (!review) {
      throw new NotFoundException(ERROR_MESSAGES.REVIEW_NOT_FOUND);
    }
    return new ResponseCommon(200, 'SUCCESS', review);
  }

  async findByReviewer(reviewerId: string): Promise<ResponseCommon<Review[]>> {
    const reviews = await this.reviewRepository.find({
      where: { reviewerId },
      relations: ['doctor', 'appointment'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', reviews);
  }

  async update(
    id: string,
    updateReviewDto: UpdateReviewDto,
    userId: string,
    isDoctor: boolean = false,
  ): Promise<ResponseCommon<Review>> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['doctor'],
    });

    if (!review) {
      throw new NotFoundException(ERROR_MESSAGES.REVIEW_NOT_FOUND);
    }

    // If doctor is responding
    if (isDoctor && updateReviewDto.doctorResponse) {
      if (review.doctor?.userId !== userId) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
      }
      await this.reviewRepository.update(id, {
        doctorResponse: updateReviewDto.doctorResponse,
        responseAt: new Date(),
      });
    } else {
      // User updating their own review
      if (review.reviewerId !== userId) {
        throw new ForbiddenException(ERROR_MESSAGES.REVIEW_EDIT_FORBIDDEN);
      }
      const updateData = { ...updateReviewDto };
      delete updateData.doctorResponse;
      await this.reviewRepository.update(id, updateData);

      // Update doctor rating if rating changed
      if (updateReviewDto.rating) {
        await this.updateDoctorRating(review.doctorId);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string, userId: string): Promise<ResponseCommon<null>> {
    const review = await this.reviewRepository.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException(ERROR_MESSAGES.REVIEW_NOT_FOUND);
    }

    if (review.reviewerId !== userId) {
      throw new ForbiddenException(ERROR_MESSAGES.REVIEW_DELETE_FORBIDDEN);
    }

    const doctorId = review.doctorId;
    await this.reviewRepository.delete(id);

    // Update doctor rating after deletion
    await this.updateDoctorRating(doctorId);

    return new ResponseCommon(200, 'Xóa đánh giá thành công', null);
  }

  private async updateDoctorRating(doctorId: string): Promise<void> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avgRating')
      .addSelect('COUNT(*)', 'totalReviews')
      .where('review.doctor_id = :doctorId', { doctorId })
      .getRawOne<{ avgRating: string | null; totalReviews: string | null }>();

    await this.doctorRepository.update(doctorId, {
      averageRating: (parseFloat(result?.avgRating ?? '0') || 0).toFixed(2),
      totalReviews: parseInt(result?.totalReviews ?? '0') || 0,
    });
  }
}
