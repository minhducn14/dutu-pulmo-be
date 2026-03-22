import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationDto } from '@/common/dto/pagination.dto';
import { NotificationStatusEnum } from '@/modules/common/enums/notification-status.enum';
import { NotificationTypeEnum } from '@/modules/common/enums/notification-type.enum';

export class NotificationQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NotificationStatusEnum })
  @IsOptional()
  @IsEnum(NotificationStatusEnum)
  status?: NotificationStatusEnum;

  @ApiPropertyOptional({ enum: NotificationTypeEnum })
  @IsOptional()
  @IsEnum(NotificationTypeEnum)
  type?: NotificationTypeEnum;
}
