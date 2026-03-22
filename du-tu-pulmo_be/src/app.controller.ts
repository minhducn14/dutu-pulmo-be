import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from '@/app.service';
import { PushNotificationService } from '@/modules/push-notification/push-notification.service';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('test-notification')
  @ApiOperation({ summary: 'Send test notification to device' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          example: 'fXz123abc456deviceToken',
        },
        title: {
          type: 'string',
          example: 'Test Notification',
        },
        body: {
          type: 'string',
          example: 'This is a test notification from the server',
        },
        data: {
          type: 'object',
          example: {
            screen: 'dashboard',
            id: 123,
          },
        },
      },
      required: ['token'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Notification send result',
    schema: {
      example: {
        success: true,
        message: 'Notification sent successfully',
      },
    },
  })
  async testNotification(
    @Body('token') token: string,
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('data') data?: any,
  ) {
    if (!token) {
      return { success: false, message: 'Token is required' };
    }

    const result = await this.pushNotificationService.sendToDevice(token, {
      title: title || 'Test Notification',
      body: body || 'This is a test notification from the server',
      data,
    });

    return {
      success: result,
      message: result
        ? 'Notification sent successfully'
        : 'Failed to send notification',
    };
  }
}
