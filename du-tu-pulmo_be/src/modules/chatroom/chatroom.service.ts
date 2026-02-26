import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatRoom } from '@/modules/chatroom/entities/chatroom.entity';
import { CreateChatRoomDto } from '@/modules/chatroom/dto/create-chatroom.dto';
import { UpdateChatRoomDto } from '@/modules/chatroom/dto/update-chatroom.dto';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

const CHATROOM_RELATIONS = [
  'user1',
  'user2',
  'user1.account',
  'user2.account',
  'messages',
];

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

    // Kiểm tra chatroom đã tồn tại giữa 2 users chưa
    const existing = await this.chatRoomRepository.findOne({
      where: [
        { user1: { id: user1Id }, user2: { id: user2Id } },
        { user1: { id: user2Id }, user2: { id: user1Id } },
      ],
      relations: CHATROOM_RELATIONS,
    });

    if (existing) {
      return new ResponseCommon(200, 'CHATROOM_ALREADY_EXISTS', existing);
    }

    const chatRoom = this.chatRoomRepository.create({
      user1: { id: user1Id },
      user2: { id: user2Id },
    });

    const saved = await this.chatRoomRepository.save(chatRoom);

    // Load full relations for response
    const full = await this.chatRoomRepository.findOne({
      where: { id: saved.id },
      relations: CHATROOM_RELATIONS,
    });

    return new ResponseCommon(201, 'SUCCESS', full!);
  }

  async findAll(): Promise<ResponseCommon<ChatRoom[]>> {
    const rooms = await this.chatRoomRepository.find({
      relations: CHATROOM_RELATIONS,
      order: { updatedAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', rooms);
  }

  async findOne(id: string): Promise<ResponseCommon<ChatRoom>> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id },
      relations: CHATROOM_RELATIONS,
    });
    if (!chatRoom) {
      throw new NotFoundException(ERROR_MESSAGES.CHATROOM_NOT_FOUND);
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

  async findByCurrentUser(userId: string): Promise<ResponseCommon<ChatRoom[]>> {
    const chatRooms = await this.chatRoomRepository.find({
      where: [{ user1: { id: userId } }, { user2: { id: userId } }],
      relations: CHATROOM_RELATIONS,
      order: { updatedAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', chatRooms);
  }

  async findBetweenUsers(
    user1Id: string,
    user2Id: string,
  ): Promise<ResponseCommon<ChatRoom[]>> {
    const chatRooms = await this.chatRoomRepository.find({
      where: [
        { user1: { id: user1Id }, user2: { id: user2Id } },
        { user1: { id: user2Id }, user2: { id: user1Id } },
      ],
      relations: CHATROOM_RELATIONS,
      order: { updatedAt: 'DESC' },
    });
    return new ResponseCommon(200, 'SUCCESS', chatRooms);
  }

  async isUserMemberOfChatRoom(
    chatRoomId: string,
    userId: string,
  ): Promise<boolean> {
    const chatRoom = await this.chatRoomRepository.findOne({
      where: { id: chatRoomId },
      relations: ['user1', 'user2'],
    });

    if (!chatRoom) return false;
    return chatRoom.user1?.id === userId || chatRoom.user2?.id === userId;
  }
}
