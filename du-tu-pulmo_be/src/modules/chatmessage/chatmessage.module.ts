import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from '@/modules/chatmessage/entities/chatmessage.entity';
import { ChatMessageService } from '@/modules/chatmessage/chatmessage.service';
import { ChatMessageController } from '@/modules/chatmessage/chatmessage.controller';
import { ChatRoomModule } from '@/modules/chatroom/chatroom.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage]), ChatRoomModule],
  controllers: [ChatMessageController],
  providers: [ChatMessageService],
  exports: [ChatMessageService, TypeOrmModule],
})
export class ChatMessageModule {}
