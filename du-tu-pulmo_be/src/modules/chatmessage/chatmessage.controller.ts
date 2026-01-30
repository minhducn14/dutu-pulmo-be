import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ChatMessageService } from '@/modules/chatmessage/chatmessage.service';
import { CreateChatMessageDto } from '@/modules/chatmessage/dto/create-chatmessage.dto';
import { UpdateChatMessageDto } from '@/modules/chatmessage/dto/update-chatmessage.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatMessageResponseDto } from '@/modules/chatmessage/dto/chatmessage-response.dto';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { ChatRoomService } from '@/modules/chatroom/chatroom.service';
import { ResponseCommon } from '@/common/dto/response.dto';

@ApiTags('Chat')
@Controller('chatmessages')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class ChatMessageController {
  constructor(
    private readonly chatMessageService: ChatMessageService,
    private readonly chatRoomService: ChatRoomService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Gửi message mới (chỉ thành viên chatroom)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ChatMessageResponseDto,
    description: 'Gửi message thành công',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Bạn không phải thành viên của chatroom này',
  })
  async create(
    @Body() createChatMessageDto: CreateChatMessageDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ChatMessageResponseDto>> {
    const isMember = await this.chatRoomService.isUserMemberOfChatRoom(
      createChatMessageDto.chatroomId,
      user.id,
    );
    if (!isMember) {
      throw new ForbiddenException(
        'Báº¡n khÃ´ng pháº£i thÃ nh viÃªn cá»§a phÃ²ng chat nÃ y',
      );
    }

    const response = await this.chatMessageService.create({
      ...createChatMessageDto,
      senderId: user.id,
    });

    return new ResponseCommon(
      response.code,
      response.message,
      ChatMessageResponseDto.fromEntity(response.data!),
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lấy danh sách tất cả message (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: [ChatMessageResponseDto] })
  async findAll(): Promise<ResponseCommon<ChatMessageResponseDto[]>> {
    const response = await this.chatMessageService.findAll();
    const data = (response.data ?? []).map((message) =>
      ChatMessageResponseDto.fromEntity(message),
    );
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get('chatroom/:chatroomId')
  @ApiOperation({
    summary: 'Lấy danh sách message theo chatroomId (chỉ thành viên)',
  })
  @ApiResponse({ status: HttpStatus.OK, type: [ChatMessageResponseDto] })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Bạn không phải thành viên của chatroom này',
  })
  async findAllByChatRoomId(
    @Param('chatroomId') chatroomId: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ChatMessageResponseDto[]>> {
    if (!user.roles?.includes('ADMIN')) {
      const isMember = await this.chatRoomService.isUserMemberOfChatRoom(
        chatroomId,
        user.id,
      );
      if (!isMember) {
        throw new ForbiddenException(
          'Báº¡n khÃ´ng pháº£i thÃ nh viÃªn cá»§a phÃ²ng chat nÃ y',
        );
      }
    }

    const response =
      await this.chatMessageService.findAllByChatRoomId(chatroomId);
    const data = (response.data ?? []).map((message) =>
      ChatMessageResponseDto.fromEntity(message),
    );
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy message theo id (chỉ thành viên chatroom)' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatMessageResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy message',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Bạn không có quyền xem message này',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ChatMessageResponseDto>> {
    const response = await this.chatMessageService.findOne(id);

    if (!user.roles?.includes('ADMIN')) {
      const chatroomId = response.data?.chatroom?.id;
      if (chatroomId) {
        const isMember = await this.chatRoomService.isUserMemberOfChatRoom(
          chatroomId,
          user.id,
        );
        if (!isMember) {
          throw new ForbiddenException(
            'Báº¡n khÃ´ng cÃ³ quyá»n xem message nÃ y',
          );
        }
      }
    }

    return new ResponseCommon(
      response.code,
      response.message,
      ChatMessageResponseDto.fromEntity(response.data!),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật message (chỉ người gửi)' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatMessageResponseDto })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Bạn chỉ có thể sửa message của mình',
  })
  async update(
    @Param('id') id: string,
    @Body() updateChatMessageDto: UpdateChatMessageDto,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ChatMessageResponseDto>> {
    const message = await this.chatMessageService.findOne(id);

    const senderId = message.data?.sender?.id;
    if (!user.roles?.includes('ADMIN') && senderId !== user.id) {
      throw new ForbiddenException(
        'Báº¡n chá»‰ cÃ³ thá»ƒ sá»­a message cá»§a mÃ¬nh',
      );
    }

    const response = await this.chatMessageService.update(
      id,
      updateChatMessageDto,
    );
    return new ResponseCommon(
      response.code,
      response.message,
      ChatMessageResponseDto.fromEntity(response.data!),
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá message (chỉ người gửi hoặc Admin)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá message thành công',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Bạn chỉ có thể xóa message của mình',
  })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<null>> {
    const message = await this.chatMessageService.findOne(id);

    const senderId = message.data?.sender?.id;
    if (!user.roles?.includes('ADMIN') && senderId !== user.id) {
      throw new ForbiddenException(
        'Báº¡n chá»‰ cÃ³ thá»ƒ xÃ³a message cá»§a mÃ¬nh',
      );
    }

    return this.chatMessageService.remove(id);
  }
}
