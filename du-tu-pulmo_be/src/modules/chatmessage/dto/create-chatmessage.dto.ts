import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateChatMessageDto {
  @IsNotEmpty()
  @ApiProperty({
    example: 'c4f2c42b-74c7-484a-893b-7b21546d4e34',
    description: 'ID chatroom',
  })
  chatroomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  @ApiProperty({
    example: 'Xin chào bác sĩ, tôi muốn tư vấn về triệu chứng ho kéo dài.',
    description: 'Nội dung tin nhắn',
  })
  content: string;
}
