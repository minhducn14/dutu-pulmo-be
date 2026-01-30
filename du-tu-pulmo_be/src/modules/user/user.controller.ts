import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from '@/modules/user/user.service';
import { UpdateUserDto } from '@/modules/user/dto/update-user.dto';
import {
  UserResponseDto,
  PaginatedUserResponseDto,
} from '@/modules/user/dto/user-response.dto';
import { UserQueryDto } from '@/modules/user/dto/user-query.dto';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { RoleEnum } from '@/modules/common/enums/role.enum';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles(RoleEnum.ADMIN)
  @ApiOperation({
    summary: 'Lấy danh sách tất cả users (Admin)',
    description:
      'Hỗ trợ phân trang, tìm kiếm theo tên/phone, lọc theo role và status',
  })
  @ApiResponse({ status: HttpStatus.OK, type: PaginatedUserResponseDto })
  async findAll(
    @Query() query: UserQueryDto,
  ): Promise<ResponseCommon<PaginatedUserResponseDto>> {
    const response = await this.userService.findAll(query);

    const items = response.data?.items ?? [];
    const mappedItems = items.map((user) => UserResponseDto.fromEntity(user));

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const totalItems = response.data?.meta?.totalItems ?? mappedItems.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    const meta = response.data?.meta ?? {
      currentPage: page,
      itemsPerPage: limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };

    return new ResponseCommon(response.code, response.message, {
      items: mappedItems,
      meta,
    });
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  async getMe(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<UserResponseDto>> {
    const response = await this.userService.findOne(user.userId);
    return new ResponseCommon(
      response.code,
      response.message,
      UserResponseDto.fromEntity(response.data!),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy user theo id (Admin hoặc chính mình)' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'User không tồn tại',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<UserResponseDto>> {
    if (!user.roles?.includes(RoleEnum.ADMIN) && user.userId !== id) {
      throw new ForbiddenException('Bạn không có quyền xem thông tin cá nhân');
    }
    const response = await this.userService.findOne(id);
    return new ResponseCommon(
      response.code,
      response.message,
      UserResponseDto.fromEntity(response.data!),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin user (Admin hoặc chính mình)' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Không có quyền truy cập',
  })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<UserResponseDto>> {
    if (!user.roles?.includes(RoleEnum.ADMIN) && user.userId !== id) {
      throw new ForbiddenException(
        'Bạn không có quyền cập nhật thông tin cá nhân',
      );
    }
    if (!user.roles?.includes(RoleEnum.ADMIN) && updateUserDto.status) {
      throw new ForbiddenException(
        'Bạn không có quyền cập nhật trạng thái tài khoản',
      );
    }
    const response = await this.userService.update(id, updateUserDto);
    return new ResponseCommon(
      response.code,
      response.message,
      UserResponseDto.fromEntity(response.data!),
    );
  }

  @Delete(':id')
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa user (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Xóa user thành công' })
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
