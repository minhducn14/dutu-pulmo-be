import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { SystemConfig } from './entities/system-config.entity';
import { UserActivity } from './entities/user-activity.entity';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, SystemConfig, UserActivity])],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService, TypeOrmModule],
})
export class SystemModule {}
