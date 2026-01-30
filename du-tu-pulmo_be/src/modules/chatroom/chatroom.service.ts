import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from '@/modules/chatroom/entities/chatroom.entity';
import { CreateChatRoomDto } from '@/modules/chatroom/dto/create-chatroom.dto';
import { UpdateChatRoomDto } from '@/modules/chatroom/dto/update-chatroom.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { CHATROOM_ERRORS } from '@/common/constants/error-messages.constant';

@Injectable()
export class ChatRoomService {
  constructor(
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
  ) {}

  async create(
    createChatRoomDto: CreateChatRoomDto,
  ): Promise<ResponseCommon<ChatRoom>> {
    const { user1Id, user2Id } = createChatRoomDto;
    const chatRoom = this.chatRoomRepository.create({
      user1: { id: user1Id },
      user2: { id: user2Id },
    });
    const saved = await this.chatRoomRepository.save(chatRoom);
    return new ResponseCommon(200, 'SUCCESS', saved);
  }

  async findAll(): Promise<ResponseCommon<ChatRoom[]>> {
    const rooms = await this.chatRoomRepository.find({
      relations: ['user1', 'user2', 'messages'],
    });
    return new ResponseCommon(200, 'SUCCESS', rooms);
  }

  async findOne(id: string): Promise<ResponseCommon<ChatRoom>> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: id },
      relations: ['user1', 'user2', 'property', 'messages'],
    });
    if (!chatRoom) {
      throw new NotFoundException(CHATROOM_ERRORS.CHATROOM_NOT_FOUND);
    }
    return new ResponseCommon(200, 'SUCCESS', chatRoom);
  }

  async update(
    id: string,
    updateChatRoomDto: UpdateChatRoomDto,
  ): Promise<ResponseCommon<ChatRoom>> {
    await this.chatRoomRepository.update(
      id,
      updateChatRoomDto as Partial<ChatRoom>,
    );
    return this.findOne(id);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.chatRoomRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }

  /**
   * Lấy tất cả chatrooms của user hiện tại
   */
  async findByCurrentUser(userId: string): Promise<ResponseCommon<ChatRoom[]>> {
    const chatRooms = await this.chatRoomRepository.find({
      where: [{ user1: { id: userId } }, { user2: { id: userId } }],
      relations: ['user1', 'user2', 'property', 'messages'],
      order: { updatedAt: 'DESC' },
    });

    return new ResponseCommon(200, 'SUCCESS', chatRooms);
  }

  /**
   * Tìm chatroom giữa 2 users cụ thể
   */
  async findBetweenUsers(
    user1Id: string,
    user2Id: string,
  ): Promise<ResponseCommon<ChatRoom[]>> {
    const chatRooms = await this.chatRoomRepository.find({
      where: [
        { user1: { id: user1Id }, user2: { id: user2Id } },
        { user1: { id: user2Id }, user2: { id: user1Id } },
      ],
      relations: ['user1', 'user2', 'property', 'messages'],
      order: { updatedAt: 'DESC' },
    });

    return new ResponseCommon(200, 'SUCCESS', chatRooms);
  }

  /**
   * Check if user is member of chatroom (for IDOR prevention)
   */
  async isUserMemberOfChatRoom(
    chatRoomId: string,
    userId: string,
  ): Promise<boolean> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
      relations: ['user1', 'user2'],
    });

    if (!chatRoom) {
      return false;
    }

    return chatRoom.user1?.id === userId || chatRoom.user2?.id === userId;
  }
}
