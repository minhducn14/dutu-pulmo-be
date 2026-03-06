import { Module } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { UserModule } from '@/modules/user/user.module';

@Module({
  imports: [UserModule],
  providers: [PushNotificationService],
  exports: [PushNotificationService]
})
export class PushNotificationModule {}
