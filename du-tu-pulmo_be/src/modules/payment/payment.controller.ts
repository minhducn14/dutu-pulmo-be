import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  Ip,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { PaymentService } from './payment.service';
import type { WebhookData } from './payos.service';
import {
  CancelPaymentDto,
  PaymentResponseDto,
} from './dto/payment-response.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RoleEnum } from '../common/enums/role.enum';
import { ResponseCommon } from 'src/common/dto/response.dto';

@ApiTags('Payment')
@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  @Post('create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Tạo payment link cho cuộc hẹn' })
  @ApiResponse({
    status: 201,
    description: 'Payment link được tạo thành công',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy cuộc hẹn' })
  @ApiResponse({
    status: 400,
    description: 'Cuộc hẹn không ở trạng thái PENDING_PAYMENT',
  })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<ResponseCommon<PaymentResponseDto>> {
    const result = await this.paymentService.createPaymentForAppointment(
      createPaymentDto,
      ip,
      userAgent,
    );
    return new ResponseCommon(
      HttpStatus.CREATED,
      'SUCCESS',
      PaymentResponseDto.fromData(result),
    );
  }

  @Get('appointment/:appointmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Lấy thông tin payment theo appointment ID' })
  @ApiParam({ name: 'appointmentId', description: 'ID cuộc hẹn' })
  @ApiResponse({
    status: 200,
    description: 'Thông tin payment',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy payment' })
  async getPaymentByAppointment(
    @Param('appointmentId') appointmentId: string,
  ): Promise<ResponseCommon<PaymentResponseDto>> {
    const result =
      await this.paymentService.getPaymentByAppointmentId(appointmentId);
    return new ResponseCommon(
      HttpStatus.OK,
      'SUCCESS',
      PaymentResponseDto.fromData(result),
    );
  }

  @Post('cancel/appointment/:appointmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hủy payment link theo appointment ID' })
  @ApiParam({ name: 'appointmentId', description: 'ID cuộc hẹn' })
  @ApiResponse({
    status: 200,
    description: 'Payment đã được hủy',
    type: PaymentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy payment' })
  @ApiResponse({
    status: 400,
    description: 'Payment không ở trạng thái PENDING',
  })
  async cancelPayment(
    @Param('appointmentId') appointmentId: string,
    @Body() cancelDto: CancelPaymentDto,
  ): Promise<ResponseCommon<PaymentResponseDto>> {
    const result = await this.paymentService.cancelPaymentByAppointmentId(
      appointmentId,
      cancelDto.reason,
    );
    return new ResponseCommon(
      HttpStatus.OK,
      'SUCCESS',
      PaymentResponseDto.fromData(result),
    );
  }

  @Get('sync/appointment/:appointmentId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Đồng bộ trạng thái payment với PayOS theo appointment ID',
  })
  @ApiParam({ name: 'appointmentId', description: 'ID cuộc hẹn' })
  @ApiResponse({
    status: 200,
    description: 'Payment đã được đồng bộ',
    type: PaymentResponseDto,
  })
  async syncPayment(
    @Param('appointmentId') appointmentId: string,
  ): Promise<ResponseCommon<PaymentResponseDto>> {
    const result =
      await this.paymentService.syncPaymentStatusByAppointmentId(appointmentId);
    return new ResponseCommon(
      HttpStatus.OK,
      'SUCCESS',
      PaymentResponseDto.fromData(result),
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook endpoint cho PayOS callback' })
  @ApiResponse({ status: 200, description: 'Webhook xử lý thành công' })
  async handleWebhook(
    @Body() webhookData: WebhookData,
  ): Promise<ResponseCommon<{ success: boolean }>> {
    await this.paymentService.handleWebhook(webhookData);
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', { success: true });
  }

  @Get('return')
  @ApiOperation({ summary: 'Return URL sau khi thanh toán thành công' })
  async handleReturn(
    @Query('orderCode') orderCode: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    // Sync payment status by orderCode (from PayOS callback)
    try {
      await this.paymentService.syncPaymentStatusByorderCode(orderCode);
    } catch {
      // Ignore errors, redirect anyway
    }

    // Get appointmentId for the redirect
    const payment = await this.paymentService.getPaymentByorderCode(orderCode);
    res.redirect(
      `${frontendUrl}/payment/success?appointmentId=${payment.appointmentId}`,
    );
  }

  @Get('cancel-callback')
  @ApiOperation({ summary: 'Cancel URL khi hủy thanh toán' })
  async handleCancel(
    @Query('orderCode') orderCode: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    // Get appointmentId for the redirect
    try {
      const payment =
        await this.paymentService.getPaymentByorderCode(orderCode);
      res.redirect(
        `${frontendUrl}/payment/cancel?appointmentId=${payment.appointmentId}`,
      );
    } catch {
      res.redirect(`${frontendUrl}/payment/cancel`);
    }
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth('JWT-auth')
  @Roles(RoleEnum.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync payment status with PayOS' })
  async syncPaymentStatus(): Promise<ResponseCommon<{ success: boolean }>> {
    await this.paymentService.syncPendingPayments();
    return new ResponseCommon(HttpStatus.OK, 'SUCCESS', { success: true });
  }
}
