import { IsNotEmpty, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID của cuộc hẹn cần thanh toán',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsNotEmpty()
  @IsUUID()
  appointmentId: string;

  @ApiProperty({
    description: 'URL chuyển hướng sau khi thanh toán thành công',
    example: 'https://example.com/payment/success',
    required: false,
  })
  @IsOptional()
  // @IsUrl()
  returnUrl?: string;

  @ApiProperty({
    description: 'URL chuyển hướng khi hủy thanh toán',
    example: 'https://example.com/payment/cancel',
    required: false,
  })
  @IsOptional()
  // @IsUrl()
  cancelUrl?: string;
}
