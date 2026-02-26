import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationService } from '@/modules/notification/notification.service';
import { NotificationController } from '@/modules/notification/notification.controller';
import { EmailModule } from '@/modules/email/email.module';
import { Notification } from '@/modules/notification/entities/notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    EmailModule
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
