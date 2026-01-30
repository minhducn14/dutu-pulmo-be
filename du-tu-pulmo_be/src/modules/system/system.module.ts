import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '@/modules/system/entities/audit-log.entity';
import { SystemConfig } from '@/modules/system/entities/system-config.entity';
import { UserActivity } from '@/modules/system/entities/user-activity.entity';
import { SystemService } from '@/modules/system/system.service';
import { SystemController } from '@/modules/system/system.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, SystemConfig, UserActivity])],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService, TypeOrmModule],
})
export class SystemModule {}
