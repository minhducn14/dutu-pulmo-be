import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';
import { NotificationStatusEnum } from '@/modules/common/enums/notification-status.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateNotificationDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'a17ee20d-cae4-422f-bf8c-11a8c0de4f32',
    description: 'ID user nhận thông báo',
  })
  userId: string;

  @IsEnum(NotificationTypeEnum)
  @ApiProperty({
    example: NotificationTypeEnum.PAYMENT,
    enum: NotificationTypeEnum,
    description: 'Loại thông báo',
  })
  type: NotificationTypeEnum;

  @IsString()
  @ApiProperty({
    example: 'Thanh toán thành công',
    description: 'Tiêu đề thông báo',
  })
  title: string;

  @IsString()
  @ApiProperty({
    example: 'Bạn vừa thanh toán tiền thuê nhà tháng 7',
    description: 'Nội dung thông báo',
  })
  content: string;

  @IsOptional()
  @IsEnum(NotificationStatusEnum)
  @ApiProperty({
    example: NotificationStatusEnum.UNREAD,
    enum: NotificationStatusEnum,
    required: false,
    description: 'Trạng thái thông báo',
  })
  status?: NotificationStatusEnum;

  @IsOptional()
  @IsUUID()
  @ApiProperty({
    example: 'b17ee20d-cae4-422f-bf8c-11a8c0de4f33',
    required: false,
    description: 'ID của entity liên quan (VD: Appointment ID)',
  })
  refId?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({
    example: 'APPOINTMENT',
    required: false,
    description: 'Loại entity liên quan',
  })
  refType?: string;
}
