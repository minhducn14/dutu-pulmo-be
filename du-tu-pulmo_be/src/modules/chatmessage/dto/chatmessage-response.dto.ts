import { ApiProperty } from '@nestjs/swagger';

export class SenderBasicDto {
  @ApiProperty({ example: '81df6c8e-902e-41f6-9d92-9433e4f5c6b7' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ example: 'nguyenvana@email.com' })
  email: string;
}

export class ChatMessageResponseDto {
  @ApiProperty({ example: '36d44d5f-b9d5-462f-bd35-4fd7e02e37ea' })
  id: string;

  @ApiProperty({ example: 'c4f2c42b-74c7-484a-893b-7b21546d4e34' })
  chatroomId: string;

  @ApiProperty({ type: SenderBasicDto })
  sender: SenderBasicDto;

  @ApiProperty({
    example: 'Xin chào bác sĩ, tôi muốn tư vấn về triệu chứng ho kéo dài.',
  })
  content: string;

  @ApiProperty({ example: '2024-07-18T08:21:09.000Z' })
  createdAt: string;
}

// Internal type used for mapping
type MessageEntityLike = {
  id: string;
  chatroom?: { id: string } | null;
  sender?: {
    id: string;
    fullName?: string;
    account?: { email?: string };
  } | null;
  content: string;
  createdAt?: Date | null;
};

export class ChatMessageMapper {
  static toDto(message: MessageEntityLike): ChatMessageResponseDto {
    const dto = new ChatMessageResponseDto();
    dto.id = message.id;
    dto.chatroomId = message.chatroom?.id ?? '';
    dto.sender = {
      id: message.sender?.id ?? '',
      fullName: message.sender?.fullName ?? '',
      email: message.sender?.account?.email ?? '',
    };
    dto.content = message.content;
    dto.createdAt = message.createdAt
      ? message.createdAt.toISOString()
      : new Date().toISOString();
    return dto;
  }

  static toDtoList(messages: MessageEntityLike[]): ChatMessageResponseDto[] {
    return messages.map((m) => this.toDto(m));
  }
}
