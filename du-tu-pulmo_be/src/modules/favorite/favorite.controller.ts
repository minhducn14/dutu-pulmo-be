import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FavoriteService } from '@/modules/favorite/favorite.service';
import { CreateFavoriteDto } from '@/modules/favorite/dto/create-favorite.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FavoriteResponseDto } from '@/modules/favorite/dto/favorite-response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Favorites')
@Controller('favorites')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Thêm bác sĩ hoặc bệnh viện vào yêu thích' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: FavoriteResponseDto,
    description: 'Thêm yêu thích thành công',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Phải cung cấp doctorId hoặc hospitalId',
  })
  async create(
    @Body() createFavoriteDto: CreateFavoriteDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<FavoriteResponseDto>> {
    const response = await this.favoriteService.create(
      createFavoriteDto,
      user.userId,
    );
    return new ResponseCommon(
      response.code,
      response.message,
      FavoriteResponseDto.fromEntity(response.data!),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách yêu thích của tôi' })
  @ApiResponse({ status: HttpStatus.OK, type: [FavoriteResponseDto] })
  async findAll(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<FavoriteResponseDto[]>> {
    const response = await this.favoriteService.findAll(user.userId);
    const data = (response.data ?? []).map((favorite) =>
      FavoriteResponseDto.fromEntity(favorite),
    );
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get('doctor/:doctorId')
  @ApiOperation({
    summary: 'Kiểm tra bác sĩ có trong danh sách yêu thích không',
  })
  @ApiResponse({ status: HttpStatus.OK, type: FavoriteResponseDto })
  async checkFavoriteDoctor(
    @Param('doctorId') doctorId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<FavoriteResponseDto | null>> {
    const response = await this.favoriteService.findByDoctor(user.userId, doctorId);
    return new ResponseCommon(
      response.code,
      response.message,
      FavoriteResponseDto.fromNullable(response.data),
    );
  }

  @Get('hospital/:hospitalId')
  @ApiOperation({
    summary: 'Kiểm tra bệnh viện có trong danh sách yêu thích không',
  })
  @ApiResponse({ status: HttpStatus.OK, type: FavoriteResponseDto })
  async checkFavoriteHospital(
    @Param('hospitalId') hospitalId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<FavoriteResponseDto | null>> {
    const response = await this.favoriteService.findByHospital(
      user.userId,
      hospitalId,
    );
    return new ResponseCommon(
      response.code,
      response.message,
      FavoriteResponseDto.fromNullable(response.data),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy favorite theo id (chỉ chủ sở hữu hoặc Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: FavoriteResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy favorite',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<FavoriteResponseDto | null>> {
    const response = await this.favoriteService.findOne(id);

    if (!user.roles?.includes('ADMIN') && response.data?.userId !== user.userId) {
      throw new ForbiddenException(ERROR_MESSAGES.FAVORITE_PERMISSION_DENIED);
    }

    return new ResponseCommon(
      response.code,
      response.message,
      FavoriteResponseDto.fromNullable(response.data),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa khỏi yêu thích (truyền doctorId, hospitalId hoặc favoriteId)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Xóa khỏi yêu thích thành công',
  })
  remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<null>> {
    return this.favoriteService.remove(id, user.userId);
  }
}
