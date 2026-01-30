import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '@/modules/system/entities/audit-log.entity';
import { SystemConfig } from '@/modules/system/entities/system-config.entity';
import { UserActivity } from '@/modules/system/entities/user-activity.entity';

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    @InjectRepository(UserActivity)
    private readonly activityRepository: Repository<UserActivity>,
  ) {}
}
