import { ERROR_MESSAGES } from '@/common/constants/error-messages.constant';
/* eslint-disable @typescript-eslint/no-unsafe-return */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, Catch, ArgumentsHost } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ChatRoomService } from '@/modules/chatroom/chatroom.service';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';

// ─── Exception Filter ────────────────────────────────────────────────────────

@Catch(WsException)
export class WebsocketExceptionsFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    const error = exception.getError();
    const details = error instanceof Object ? { ...error } : { message: error };
    client.emit('exception', {
      socketId: client.id,
      ...details,
    });
  }
}

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface JoinRoomData {
  chatroomId: string;
}

interface TypingData {
  chatroomId: string;
  isTyping: boolean;
}

interface UserInfo {
  id: string;
  fullName: string;
  email: string;
}

interface UserTypingInfo {
  userId: string;
  fullName: string;
  isTyping: boolean;
  timestamp: number;
}

// ─── Gateway ─────────────────────────────────────────────────────────────────

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  namespace: '/chat',
})
@UseFilters(new WebsocketExceptionsFilter())
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // userId → { socketId, user }
  private onlineUsers = new Map<string, { socketId: string; user: UserInfo }>();

  // chatroomId → (userId → UserTypingInfo)
  private typingUsers = new Map<string, Map<string, UserTypingInfo>>();

  // chatroomId → (userId → timeout)
  private typingTimeouts = new Map<string, Map<string, NodeJS.Timeout>>();

  private readonly TYPING_TIMEOUT_MS = 3000;

  constructor(
    private chatRoomService: ChatRoomService,
    private jwtService: JwtService,
  ) {}

  afterInit() {
    this.logger.log('🚀 ChatGateway initialized at namespace /chat');
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);

      if (!token) {
        this.logger.warn(`[${client.id}] No token — disconnecting`);
        client.emit('exception', {
          message: 'Unauthorized: no token provided',
        });
        client.disconnect(true);
        return;
      }

      const payloadUnknown: unknown = await this.jwtService.verifyAsync(token);
      if (!payloadUnknown || typeof payloadUnknown !== 'object') {
        client.emit('exception', { message: 'Unauthorized: invalid token' });
        this.logger.error(`[${client.id}] Invalid JWT payload`);
        client.disconnect(true);
        return;
      }

      const payload = payloadUnknown as Record<string, unknown>;
      const email =
        typeof payload.email === 'string' ? payload.email : undefined;
      const sub = typeof payload.sub === 'string' ? payload.sub : undefined;
      const id = typeof payload.id === 'string' ? payload.id : undefined;
      const fullName =
        typeof payload.fullName === 'string' ? payload.fullName : undefined;
      const name = typeof payload.name === 'string' ? payload.name : undefined;
      const user: UserInfo = {
        id: sub || id || '',
        email: email ?? '',
        fullName: fullName || name || email?.split('@')[0] || '',
      };

      if (!user.id || !user.email) {
        this.logger.warn(`[${client.id}] Invalid JWT payload — disconnecting`);
        client.disconnect(true);
        return;
      }

      client.data.user = user;

      // Nếu user đang có session cũ, disconnect session đó
      const existingSession = this.onlineUsers.get(user.id);
      if (existingSession) {
        const existingSocket = this.server.sockets.sockets.get(
          existingSession.socketId,
        );
        existingSocket?.disconnect(true);
      }

      this.onlineUsers.set(user.id, { socketId: client.id, user });

      this.logger.log(`✅ [${client.id}] User "${user.fullName}" connected`);

      // Thông báo cho các client khác
      client.broadcast.emit('user-online', {
        userId: user.id,
        fullName: user.fullName,
        timestamp: new Date().toISOString(),
      });

      // Trả về danh sách online ngay khi connect
      client.emit('online-users', this.getOnlineUsers());
    } catch (error) {
      this.logger.error(`[${client.id}] Connection error:`, error.message);
      client.emit('exception', { message: 'Unauthorized: invalid token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    try {
      const user: UserInfo = client.data.user;
      if (!user) return;

      this.onlineUsers.delete(user.id);
      this.cleanupUserTyping(user.id);

      this.logger.log(`❌ [${client.id}] User "${user.fullName}" disconnected`);

      client.broadcast.emit('user-offline', {
        userId: user.id,
        fullName: user.fullName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Disconnect error:', error);
    }
  }

  // ─── Room Events ───────────────────────────────────────────────────────────

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() data: JoinRoomData,
    @ConnectedSocket() client: Socket,
  ) {
    const { chatroomId } = data;
    const user: UserInfo = client.data.user;

    if (!chatroomId) {
      this.logger.error(`[${client.id}] Invalid chatroomId`);
      throw new WsException(ERROR_MESSAGES.OPERATION_FAILED);
    }

    const chatRoom = await this.chatRoomService.findOne(chatroomId);
    const room = chatRoom.data;
    if (!room) {
      this.logger.error(`[${client.id}] Chat room not found`);
      throw new WsException(ERROR_MESSAGES.OPERATION_FAILED);
    }
    const isParticipant =
      room.user1?.id === user.id || room.user2?.id === user.id;
    if (!isParticipant) {
      this.logger.error(`[${client.id}] User is not a participant`);
      throw new WsException(ERROR_MESSAGES.OPERATION_FAILED);
    }

    await client.join(chatroomId);

    this.logger.log(`User "${user.fullName}" joined room ${chatroomId}`);

    // Confirm join cho chính client
    client.emit('joined-room', {
      chatroomId,
      message: 'Successfully joined chat room',
    });

    // Notify các user khác trong room
    client.to(chatroomId).emit('user-joined-room', {
      chatroomId,
      userId: user.id,
      fullName: user.fullName,
      timestamp: new Date().toISOString(),
    });
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() data: JoinRoomData,
    @ConnectedSocket() client: Socket,
  ) {
    const { chatroomId } = data;
    const user: UserInfo = client.data.user;

    if (!chatroomId) {
      this.logger.error(`[${client.id}] Invalid chatroomId`);
      throw new WsException(ERROR_MESSAGES.OPERATION_FAILED);
    }

    await client.leave(chatroomId);
    this.clearUserTypingInRoom(chatroomId, user.id);

    this.logger.log(`User "${user.fullName}" left room ${chatroomId}`);

    client.to(chatroomId).emit('user-left-room', {
      chatroomId,
      userId: user.id,
      fullName: user.fullName,
      timestamp: new Date().toISOString(),
    });
  }

  // ─── Typing ────────────────────────────────────────────────────────────────

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: TypingData,
    @ConnectedSocket() client: Socket,
  ) {
    const { chatroomId, isTyping } = data;
    const user: UserInfo = client.data.user;

    if (!chatroomId) return;

    if (!this.typingUsers.has(chatroomId)) {
      this.typingUsers.set(chatroomId, new Map());
    }

    const typingInRoom = this.typingUsers.get(chatroomId)!;

    if (isTyping) {
      if (!this.typingTimeouts.has(chatroomId)) {
        this.typingTimeouts.set(chatroomId, new Map());
      }

      const userTimeouts = this.typingTimeouts.get(chatroomId)!;
      const existing = userTimeouts.get(user.id);
      if (existing) clearTimeout(existing);

      typingInRoom.set(user.id, {
        userId: user.id,
        fullName: user.fullName,
        isTyping: true,
        timestamp: Date.now(),
      });

      const timeout = setTimeout(() => {
        this.clearUserTypingInRoom(chatroomId, user.id);
      }, this.TYPING_TIMEOUT_MS);

      userTimeouts.set(user.id, timeout);
    } else {
      this.clearUserTypingInRoom(chatroomId, user.id);
    }

    this.logger.log(`User "${user.fullName}" is typing in room ${chatroomId}`);
    client.to(chatroomId).emit('user-typing', {
      chatroomId,
      users: Array.from(typingInRoom.values()),
    });
  }

  // ─── Online Users ──────────────────────────────────────────────────────────

  @SubscribeMessage('get-online-users')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    client.emit('online-users', this.getOnlineUsers());
  }

  // ─── Public Methods (gọi từ REST controller) ───────────────────────────────

  public emitMessageToRoom(chatroomId: string, messageData: unknown) {
    try {
      this.server.to(chatroomId).emit('new-message', messageData);
      this.logger.log(`Message emitted to room ${chatroomId}`);
    } catch (error) {
      this.logger.error(`Error emitting to room ${chatroomId}:`, error);
    }
  }

  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  public getOnlineUsers(): UserInfo[] {
    return Array.from(this.onlineUsers.values()).map((item) => item.user);
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private extractToken(client: Socket): string | undefined {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    const fromQuery = client.handshake.query.token as string;
    if (fromQuery) return fromQuery;

    const fromAuth = client.handshake.auth?.token;
    if (fromAuth) return fromAuth;

    return undefined;
  }

  private clearUserTypingInRoom(chatroomId: string, userId: string) {
    // Clear timeout
    const userTimeouts = this.typingTimeouts.get(chatroomId);
    if (userTimeouts) {
      const timeout = userTimeouts.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        userTimeouts.delete(userId);
      }
    }

    // Remove from typing map và broadcast
    const typingInRoom = this.typingUsers.get(chatroomId);
    if (typingInRoom?.has(userId)) {
      typingInRoom.delete(userId);
      this.server.to(chatroomId).emit('user-typing', {
        chatroomId,
        users: Array.from(typingInRoom.values()),
      });
    }
  }

  /**
   * Cleanup tất cả typing state của 1 user khi họ disconnect
   */
  private cleanupUserTyping(userId: string) {
    for (const [chatroomId] of this.typingUsers) {
      this.clearUserTypingInRoom(chatroomId, userId);
    }
    for (const [, userTimeouts] of this.typingTimeouts) {
      const timeout = userTimeouts.get(userId);
      if (timeout) {
        clearTimeout(timeout);
        userTimeouts.delete(userId);
      }
    }
  }
}
