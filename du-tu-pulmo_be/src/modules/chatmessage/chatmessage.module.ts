import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from './entities/chatmessage.entity';
import { ChatMessageService } from './chatmessage.service';
import { ChatMessageController } from './chatmessage.controller';
import { ChatRoomModule } from '../chatroom/chatroom.module';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage]), ChatRoomModule],
  controllers: [ChatMessageController],
  providers: [ChatMessageService],
  exports: [ChatMessageService, TypeOrmModule],
})
export class ChatMessageModule {}
