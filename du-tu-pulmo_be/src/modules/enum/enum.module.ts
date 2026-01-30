import { Module } from '@nestjs/common';
import { EnumController } from '@/modules/enum/enum.controller';
import { EnumService } from '@/modules/enum/enum.service';

@Module({
  controllers: [EnumController],
  providers: [EnumService],
})
export class EnumModule {}
