import { PartialType } from '@nestjs/mapped-types';
import { CreateNotificationDto } from '@/modules/notification/dto/create-notification.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationStatusEnum } from '@/modules/common/enums/notification-status.enum';

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {
  @ApiPropertyOptional({
    example: 'fd2c7dbb-7031-4d6c-a548-123b12f6e5cd',
    description: 'ID notification',
  })
  id?: string;

  @ApiPropertyOptional({
    example: NotificationStatusEnum.UNREAD,
    enum: NotificationStatusEnum,
  })
  status?: NotificationStatusEnum;
}
