import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from '@/modules/chatroom/entities/chatroom.entity';
import { ChatRoomService } from '@/modules/chatroom/chatroom.service';
import { ChatRoomController } from '@/modules/chatroom/chatroom.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChatRoom])],
  controllers: [ChatRoomController],
  providers: [ChatRoomService],
  exports: [ChatRoomService, TypeOrmModule],
})
export class ChatRoomModule {}
