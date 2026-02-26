import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from '@/modules/chatmessage/entities/chatmessage.entity';
import { CreateChatMessageDto } from '@/modules/chatmessage/dto/create-chatmessage.dto';
import { UpdateChatMessageDto } from '@/modules/chatmessage/dto/update-chatmessage.dto';
import { ResponseCommon } from '@/common/dto/response.dto';

const MESSAGE_RELATIONS = ['chatroom', 'sender', 'sender.account'];

@Injectable()
export class ChatMessageService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatMessageRepository: Repository<ChatMessage>,
  ) {}

  async create(
    createChatMessageDto: CreateChatMessageDto,
  ): Promise<ResponseCommon<ChatMessage>> {
    const { chatroomId, senderId, content } = createChatMessageDto;

    const chatMessage = this.chatMessageRepository.create({
      chatroom: { id: chatroomId },
      sender: { id: senderId },
      content,
    });

    const saved = await this.chatMessageRepository.save(chatMessage);

    const fullMessage = await this.chatMessageRepository.findOne({
      where: { id: saved.id },
      relations: MESSAGE_RELATIONS,
    });

    if (!fullMessage) {
      throw new Error('Failed to retrieve saved message');
    }

    return new ResponseCommon(201, 'SUCCESS', fullMessage);
  }

  async findAll(): Promise<ResponseCommon<ChatMessage[]>> {
    const messages = await this.chatMessageRepository.find({
      relations: MESSAGE_RELATIONS,
      order: { createdAt: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', messages);
  }

  async findAllByChatRoomId(
    chatroomId: string,
  ): Promise<ResponseCommon<ChatMessage[]>> {
    const messages = await this.chatMessageRepository.find({
      where: { chatroom: { id: chatroomId } },
      relations: MESSAGE_RELATIONS,
      order: { createdAt: 'ASC' },
    });
    return new ResponseCommon(200, 'SUCCESS', messages);
  }

  async findOne(id: string): Promise<ResponseCommon<ChatMessage | null>> {
    const message = await this.chatMessageRepository.findOne({
      where: { id },
      relations: MESSAGE_RELATIONS,
    });
    return new ResponseCommon(200, 'SUCCESS', message);
  }

  async update(
    id: string,
    updateChatMessageDto: UpdateChatMessageDto,
  ): Promise<ResponseCommon<ChatMessage>> {
    // Chỉ update content
    await this.chatMessageRepository.update(id, {
      content: updateChatMessageDto.content,
    });
    const updatedMessage = await this.chatMessageRepository.findOne({
      where: { id },
      relations: MESSAGE_RELATIONS,
    });
    if (!updatedMessage) {
      throw new Error(`ChatMessage with id ${id} not found`);
    }
    return new ResponseCommon(200, 'SUCCESS', updatedMessage);
  }

  async remove(id: string): Promise<ResponseCommon<null>> {
    await this.chatMessageRepository.delete(id);
    return new ResponseCommon(200, 'SUCCESS', null);
  }
}
