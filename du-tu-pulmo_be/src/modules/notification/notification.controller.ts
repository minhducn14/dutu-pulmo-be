import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo của user (có phân trang)' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách thông báo',
    type: NotificationResponseDto,
    isArray: true,
  })
  async getUserNotifications(
    @CurrentUser() user: JwtUser,
    @Query() query: PaginationDto,
  ) {
    return this.notificationService.findUserNotifications(user.id, query);
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo của user là đã đọc' })
  @ApiResponse({
    status: 200,
    description: 'Thành công',
  })
  async markAllAsRead(@CurrentUser() user: JwtUser) {
    const success = await this.notificationService.markAllAsRead(user.id);
    return {
      success,
      message: 'Đã đánh dấu tất cả là đã đọc',
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo là đã đọc' })
  @ApiResponse({
    status: 200,
    description: 'Thành công',
  })
  async markAsRead(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    const success = await this.notificationService.markAsRead(user.id, id);
    return {
      success,
      message: success
        ? 'Đã đánh dấu đọc thành công'
        : 'Không tìm thấy thông báo hoặc đã được đọc',
    };
  }
}
