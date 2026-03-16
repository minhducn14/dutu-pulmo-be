import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '@/common/dto/pagination.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { CurrentUser } from '@/common/decorators/user.decorator';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';
import { NotificationService } from './notification.service';
import { Notification } from '@/modules/notification/entities/notification.entity';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationQueryDto } from '@/modules/notification/dto/notification-query.dto';
import { NotificationActionResponseDto } from '@/modules/notification/dto/notification-action-response.dto';
import { NotificationUnreadCountResponseDto } from '@/modules/notification/dto/notification-unread-count-response.dto';

@ApiTags('Notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
@ApiExtraModels(
  ResponseCommon,
  PaginatedResponseDto,
  PaginationMetaDto,
  NotificationResponseDto,
  NotificationActionResponseDto,
  NotificationUnreadCountResponseDto,
)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  private toNotificationDto(
    notification: Notification,
  ): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      status: notification.status,
      createdAt: notification.createdAt?.toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách thông báo của user (có phân trang)' })
  @ApiOkResponse({
    description: 'Danh sách thông báo',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ResponseCommon) },
        {
          properties: {
            data: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: { $ref: getSchemaPath(NotificationResponseDto) },
                },
                meta: { $ref: getSchemaPath(PaginationMetaDto) },
              },
              required: ['items', 'meta'],
            },
          },
        },
      ],
    },
  })
  async getUserNotifications(
    @CurrentUser() user: JwtUser,
    @Query() query: NotificationQueryDto,
  ): Promise<ResponseCommon<PaginatedResponseDto<NotificationResponseDto>>> {
    const response = await this.notificationService.findUserNotifications(
      user.userId,
      query,
    );
    const fallback = new PaginatedResponseDto<Notification>(
      [],
      0,
      query.page ?? 1,
      query.limit ?? 10,
    );
    const pageData = response.data ?? fallback;
    const items = (pageData.items ?? []).map((item) =>
      this.toNotificationDto(item),
    );
    return new ResponseCommon(response.code, response.message, {
      items,
      meta: pageData.meta,
    });
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Lấy số lượng thông báo chưa đọc của user hiện tại',
  })
  @ApiOkResponse({
    description: 'Số lượng thông báo chưa đọc',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ResponseCommon) },
        {
          properties: {
            data: { $ref: getSchemaPath(NotificationUnreadCountResponseDto) },
          },
        },
      ],
    },
  })
  async getUnreadCount(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<NotificationUnreadCountResponseDto>> {
    const count = await this.notificationService.getUnreadCount(user.userId);
    return new ResponseCommon(200, 'SUCCESS', { count });
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu tất cả thông báo của user là đã đọc' })
  @ApiOkResponse({
    description: 'Thành công',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ResponseCommon) },
        {
          properties: {
            data: { $ref: getSchemaPath(NotificationActionResponseDto) },
          },
        },
      ],
    },
  })
  async markAllAsRead(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<NotificationActionResponseDto>> {
    const success = await this.notificationService.markAllAsRead(user.userId);
    return new ResponseCommon(200, 'SUCCESS', {
      success,
      message: 'Đã đánh dấu tất cả là đã đọc',
    });
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đánh dấu 1 thông báo là đã đọc' })
  @ApiOkResponse({
    description: 'Thành công',
    schema: {
      allOf: [
        { $ref: getSchemaPath(ResponseCommon) },
        {
          properties: {
            data: { $ref: getSchemaPath(NotificationActionResponseDto) },
          },
        },
      ],
    },
  })
  async markAsRead(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ): Promise<ResponseCommon<NotificationActionResponseDto>> {
    const success = await this.notificationService.markAsRead(user.userId, id);
    return new ResponseCommon(200, 'SUCCESS', {
      success,
      message: success
        ? 'Đã đánh dấu thành công'
        : 'Không tìm thấy thông báo hoặc đã được đánh dấu',
    });
  }

  @Post('test-push')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test end-to-end lưu thông báo vào DB và gửi Push Notifications',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', example: 'Test Push Notification' },
        content: { type: 'string', example: 'Nội dung test gửi Push đã lưu' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Tạo thông báo thành công và gửi Push ngầm',
    type: NotificationResponseDto,
  })
  async testPushNotification(
    @CurrentUser() user: JwtUser,
    @Body('title') title: string,
    @Body('content') content: string,
  ): Promise<ResponseCommon<NotificationResponseDto>> {
    const notification = await this.notificationService.createNotification({
      userId: user.userId,
      title: title || 'Test Push E2E',
      content:
        content || 'Thông báo lưu DB và broadcast event notification.created',
      type: NotificationTypeEnum.SYSTEM,
    });

    return new ResponseCommon(
      200,
      'SUCCESS',
      this.toNotificationDto(notification),
    );
  }
}
