import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '../entities/payment.entity';
import { IsOptional, IsString } from 'class-validator';

export class PaymentResponseDto {
  @ApiProperty({
    description: 'ID của payment',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Mã lịch hẹn',
    example: '1704729600123',
  })
  orderCode: string;

  @ApiProperty({
    description: 'Số tiền thanh toán (VND)',
    example: '150000',
  })
  amount: string;

  @ApiProperty({
    description: 'Mô tả thanh toán',
    example: 'Thanh toán lịch hẹn #APT-ABC123',
  })
  description: string;

  @ApiProperty({
    description: 'Trạng thái thanh toán',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @ApiProperty({
    description: 'URL trang thanh toán',
    example: 'https://pay.payos.vn/web/abc123',
  })
  checkoutUrl: string;

  @ApiProperty({
    description: 'Mã QR để thanh toán (base64)',
    example: 'data:image/png;base64,...',
  })
  qrCode: string;

  @ApiProperty({
    description: 'ID cuộc hẹn',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  appointmentId: string;

  @ApiProperty({
    description: 'Thời gian tạo',
    example: '2026-01-08T14:30:00.000Z',
  })
  createdAt: Date;
}

export class CancelPaymentDto {
  @ApiProperty({
    description: 'Lý do hủy thanh toán',
    example: 'Khách hàng đổi ý',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
