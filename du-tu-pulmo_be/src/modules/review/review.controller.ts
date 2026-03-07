import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ReviewService } from '@/modules/review/review.service';
import { CreateReviewDto } from '@/modules/review/dto/create-review.dto';
import { UpdateReviewDto } from '@/modules/review/dto/update-review.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ReviewResponseDto } from '@/modules/review/dto/review-response.dto';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Reviews')
@Controller('reviews')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo đánh giá bác sĩ mới' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ReviewResponseDto,
    description: 'Tạo đánh giá thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Request không hợp lệ hoặc đã đánh giá cuộc hẹn này',
  })
  async create(
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ReviewResponseDto>> {
    const response = await this.reviewService.create(createReviewDto, user.userId);
    return new ResponseCommon(
      response.code,
      response.message,
      ReviewResponseDto.fromEntity(response.data!),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách tất cả đánh giá' })
  @ApiResponse({ status: HttpStatus.OK, type: [ReviewResponseDto] })
  async findAll(): Promise<ResponseCommon<ReviewResponseDto[]>> {
    const response = await this.reviewService.findAll();
    const data = (response.data ?? []).map((review) =>
      ReviewResponseDto.fromEntity(review),
    );
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá theo bác sĩ' })
  @ApiResponse({ status: HttpStatus.OK, type: [ReviewResponseDto] })
  async findAllByDoctorId(
    @Param('doctorId') doctorId: string,
  ): Promise<ResponseCommon<ReviewResponseDto[]>> {
    const response = await this.reviewService.findAllByDoctorId(doctorId);
    const data = (response.data ?? []).map((review) =>
      ReviewResponseDto.fromEntity(review),
    );
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get('my-reviews')
  @ApiOperation({ summary: 'Lấy danh sách đánh giá của tôi' })
  @ApiResponse({ status: HttpStatus.OK, type: [ReviewResponseDto] })
  async findMyReviews(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ReviewResponseDto[]>> {
    const response = await this.reviewService.findByReviewer(user.userId);
    const data = (response.data ?? []).map((review) =>
      ReviewResponseDto.fromEntity(review),
    );
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy đánh giá theo id' })
  @ApiResponse({ status: HttpStatus.OK, type: ReviewResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy đánh giá',
  })
  async findOne(
    @Param('id') id: string,
  ): Promise<ResponseCommon<ReviewResponseDto>> {
    const response = await this.reviewService.findOne(id);
    return new ResponseCommon(
      response.code,
      response.message,
      ReviewResponseDto.fromEntity(response.data!),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật đánh giá' })
  @ApiResponse({ status: HttpStatus.OK, type: ReviewResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ReviewResponseDto>> {
    const response = await this.reviewService.update(
      id,
      updateReviewDto,
      user.userId,
    );
    return new ResponseCommon(
      response.code,
      response.message,
      ReviewResponseDto.fromEntity(response.data!),
    );
  }

  @Patch(':id/response')
  @ApiOperation({ summary: 'Bác sĩ phản hồi đánh giá' })
  @ApiResponse({ status: HttpStatus.OK, type: ReviewResponseDto })
  async respondToReview(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ReviewResponseDto>> {
    const response = await this.reviewService.update(
      id,
      updateReviewDto,
      user.userId,
      true,
    );
    return new ResponseCommon(
      response.code,
      response.message,
      ReviewResponseDto.fromEntity(response.data!),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa đánh giá' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xóa đánh giá thành công',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<null>> {
    return this.reviewService.remove(id, user.userId);
  }
}
