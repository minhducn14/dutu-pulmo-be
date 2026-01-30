import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from '@/modules/chat/chat.gateway';
import { ChatMessageModule } from '@/modules/chatmessage/chatmessage.module';
import { ChatRoomModule } from '@/modules/chatroom/chatroom.module';

@Module({
  imports: [
    ChatMessageModule,
    ChatRoomModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN') ?? ('24h' as const),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
