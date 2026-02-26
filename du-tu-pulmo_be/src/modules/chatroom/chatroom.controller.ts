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
  NotFoundException,
} from '@nestjs/common';
import { ChatRoomService } from '@/modules/chatroom/chatroom.service';
import { UpdateChatRoomDto } from '@/modules/chatroom/dto/update-chatroom.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ChatRoomResponseDto } from '@/modules/chatroom/dto/chatroom-response.dto';
import { JwtAuthGuard } from '@/modules/core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/core/auth/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CreateChatRoomDto } from '@/modules/chatroom/dto/create-chatroom.dto';
import { CurrentUser } from '@/common/decorators/user.decorator';
import type { JwtUser } from '@/modules/core/auth/strategies/jwt.strategy';
import { ResponseCommon } from '@/common/dto/response.dto';
import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';

@ApiTags('Chat')
@Controller('chatrooms')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
export class ChatRoomController {
  constructor(private readonly chatRoomService: ChatRoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tạo hoặc lấy chatroom giữa 2 users' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    type: ChatRoomResponseDto,
    description: 'Tạo hoặc lấy chatroom thành công',
  })
  async create(
    @Body() createChatRoomDto: CreateChatRoomDto,
  ): Promise<ResponseCommon<ChatRoomResponseDto>> {
    const response = await this.chatRoomService.create(createChatRoomDto);
    return new ResponseCommon(
      response.code,
      response.message,
      ChatRoomResponseDto.fromEntity(response.data!),
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Lấy danh sách tất cả chatroom (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: [ChatRoomResponseDto] })
  async findAll(): Promise<ResponseCommon<ChatRoomResponseDto[]>> {
    const response = await this.chatRoomService.findAll();
    const data = (response.data ?? []).map((room) =>
      ChatRoomResponseDto.fromEntity(room),
    );
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get('my-chats')
  @ApiOperation({ summary: 'Lấy tất cả chatrooms của user hiện tại' })
  @ApiResponse({
    status: HttpStatus.OK,
    type: [ChatRoomResponseDto],
    description: 'Lấy danh sách chat thành công',
  })
  async getMyChats(
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ChatRoomResponseDto[]>> {
    const response = await this.chatRoomService.findByCurrentUser(user.id);
    const data = (response.data ?? []).map((room) =>
      ChatRoomResponseDto.fromEntity(room),
    );
    return new ResponseCommon(response.code, response.message, data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chatroom theo id (chỉ thành viên hoặc Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatRoomResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Không tìm thấy chatroom',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Bạn không phải thành viên của chatroom này',
  })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ): Promise<ResponseCommon<ChatRoomResponseDto>> {
    const response = await this.chatRoomService.findOne(id);

    if (!response.data) {
      throw new NotFoundException(ERROR_MESSAGES.CHATROOM_NOT_FOUND);
    }

    if (!user.roles?.includes('ADMIN')) {
      const isMember = await this.chatRoomService.isUserMemberOfChatRoom(
        id,
        user.id,
      );
      if (!isMember) {
        throw new ForbiddenException(ERROR_MESSAGES.NOT_MEMBER);
      }
    }

    return new ResponseCommon(
      response.code,
      response.message,
      ChatRoomResponseDto.fromEntity(response.data),
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Cập nhật chatroom (Admin)' })
  @ApiResponse({ status: HttpStatus.OK, type: ChatRoomResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updateChatRoomDto: UpdateChatRoomDto,
  ): Promise<ResponseCommon<ChatRoomResponseDto>> {
    const response = await this.chatRoomService.update(id, updateChatRoomDto);
    return new ResponseCommon(
      response.code,
      response.message,
      ChatRoomResponseDto.fromEntity(response.data!),
    );
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Xoá chatroom (Admin)' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Xoá chatroom thành công',
  })
  remove(@Param('id') id: string): Promise<ResponseCommon<null>> {
    return this.chatRoomService.remove(id);
  }
}
