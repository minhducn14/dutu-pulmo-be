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
  Post,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import type { JwtUser } from '../core/auth/strategies/jwt.strategy';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lấy danh sách tất cả users (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: [UserResponseDto] })
  findAll() {
    return this.userService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Lấy thông tin user hiện tại' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  getMe(@CurrentUser() user: JwtUser) {
    return this.userService.findOne(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy user theo id (Admin hoặc chính mình)' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User không tồn tại' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Không có quyền truy cập' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    if (!user.roles?.includes('ADMIN') && user.userId !== id) {
      throw new ForbiddenException('Bạn chỉ có thể xem thông tin của mình');
    }
    return this.userService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin user (Admin hoặc chính mình)' })
  @ApiResponse({ status: HttpStatus.OK, type: UserResponseDto })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Không có quyền truy cập' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: JwtUser,
  ) {
    if (!user.roles?.includes('ADMIN') && user.userId !== id) {
      throw new ForbiddenException('Bạn chỉ có thể cập nhật thông tin của mình');
    }
    if (!user.roles?.includes('ADMIN') && updateUserDto.status) {
      throw new ForbiddenException('Bạn không có quyền cập nhật trạng thái tài khoản');
    }
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xóa user (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Xóa user thành công' })
  remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }
}
