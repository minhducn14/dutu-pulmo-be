import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAction } from '@/modules/admin-action/entities/admin-action.entity';
import { AdminActionService } from '@/modules/admin-action/admin-action.service';
import { AdminActionController } from '@/modules/admin-action/admin-action.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAction])],
  controllers: [AdminActionController],
  providers: [AdminActionService],
  exports: [AdminActionService, TypeOrmModule],
})
export class AdminActionModule {}
