import { Module } from '@nestjs/common';
import { EnumController } from './enum.controller';
import { EnumService } from './enum.service';

@Module({
  controllers: [EnumController],
  providers: [EnumService],
})
export class EnumModule {}
