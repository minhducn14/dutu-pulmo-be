import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { Review } from '@/modules/review/entities/review.entity';
import { CreateReviewDto } from '@/modules/review/dto/create-review.dto';
import { UpdateReviewDto } from '@/modules/review/dto/update-review.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { Doctor } from '@/modules/doctor/entities/doctor.entity';
import { ReviewResponseDto } from '@/modules/review/dto/review-response.dto';
import { Appointment } from '@/modules/appointment/entities/appointment.entity';
import { AppointmentStatusEnum } from '../common/enums/appointment-status.enum';

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(Doctor)
    private doctorRepository: Repository<Doctor>,
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  async create(
    createReviewDto: CreateReviewDto,
    reviewerId: string,
  ): Promise<ResponseCommon<Review>> {
    const { doctorId, appointmentId, comment, rating, isAnonymous } =
      createReviewDto;

    // Check if already reviewed this appointment
    if (appointmentId) {
      const appointment = await this.appointmentRepository.findOne({
        where: { id: appointmentId },
        relations: ['patient', 'patient.user'],
      });

      if (!appointment) {
        throw new NotFoundException(ERROR_MESSAGES.RESOURCE_NOT_FOUND);
      }

      if (appointment.patient?.userId !== reviewerId) {
        throw new ForbiddenException(ERROR_MESSAGES.ACCESS_DENIED);
      }

      if (appointment.status !== AppointmentStatusEnum.COMPLETED) {
        throw new BadRequestException(
          'Chỉ có thể đánh giá sau khi hoàn thành khám',
        );
      }

      if (appointment.doctorId !== doctorId) {
        throw new BadRequestException(ERROR_MESSAGES.INVALID_REQUEST);
      }

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

    // Sync rating to Appointment
    if (appointmentId) {
      await this.appointmentRepository.update(appointmentId, {
        patientRating: rating,
      });
    }

    return new ResponseCommon(201, 'Đánh giá thành công', saved);
  }

  async findAll(): Promise<ResponseCommon<Review[]>> {
    const reviews = await this.reviewRepository.find({
      relations: ['reviewer', 'doctor', 'doctor.user', 'appointment'],
      order: { createdAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', reviews);
  }

  async findAllByDoctorId(doctorId: string): Promise<ResponseCommon<Review[]>> {
    const reviews = await this.reviewRepository.find({
      where: { doctorId },
      relations: ['reviewer', 'doctor.user', 'doctor', 'appointment'],
      order: { createdAt: 'DESC' },
    });

    return new ResponseCommon(200, 'SUCCESS', reviews);
  }

  async findOne(id: string): Promise<ResponseCommon<Review>> {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: ['reviewer', 'doctor', 'doctor.user', 'appointment'],
    });
    if (!review) {
      throw new NotFoundException(ERROR_MESSAGES.REVIEW_NOT_FOUND);
    }
    return new ResponseCommon(200, 'SUCCESS', review);
  }

  async findByReviewer(reviewerId: string): Promise<ResponseCommon<Review[]>> {
    const reviews = await this.reviewRepository.find({
      where: { reviewerId },
      relations: ['doctor', 'doctor.user', 'appointment', 'reviewer'],
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
      relations: ['doctor', 'doctor.user', 'appointment', 'reviewer'],
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
        if (review.appointmentId) {
          await this.appointmentRepository.update(review.appointmentId, {
            patientRating: updateReviewDto.rating,
          });
        }
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

    // Clear rating from Appointment
    if (review.appointmentId) {
      await this.appointmentRepository.update(review.appointmentId, {
        patientRating: null,
      });
    }

    return new ResponseCommon(200, 'Xóa đánh giá thành công', null);
  }

  /**
   * One-time sync function to update patientRating in Appointment table
   * from existing records in Reviews table.
   */
  async syncExistingReviewsToAppointments(): Promise<ResponseCommon<any>> {
    const reviews = await this.reviewRepository.find({
      where: { appointmentId: Not(IsNull()) },
    });

    let updatedCount = 0;
    for (const review of reviews) {
      await this.appointmentRepository.update(review.appointmentId, {
        patientRating: review.rating,
      });
      updatedCount++;
    }

    return new ResponseCommon(200, `Đã đồng bộ ${updatedCount} bản ghi`, {
      updatedCount,
    });
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
