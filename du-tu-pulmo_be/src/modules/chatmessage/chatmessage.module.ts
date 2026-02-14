import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from '@/modules/chatmessage/entities/chatmessage.entity';
import { ChatMessageService } from '@/modules/chatmessage/chatmessage.service';
import { ChatMessageController } from '@/modules/chatmessage/chatmessage.controller';
import { ChatRoomModule } from '@/modules/chatroom/chatroom.module';
import { ChatModule } from '@/modules/chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage]),
    ChatRoomModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [ChatMessageController],
  providers: [ChatMessageService],
  exports: [ChatMessageService, TypeOrmModule],
})
export class ChatMessageModule {}