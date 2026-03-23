import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MedicalRecordAuditLog } from './entities/medical-record-audit-log.entity';
import { MEDICAL_AUDIT_EVENT } from './medical-audit.service';
import type { MedicalAuditLogParams } from './medical-audit.service';

@Injectable()
export class MedicalAuditListener {
  private readonly logger = new Logger(MedicalAuditListener.name);

  constructor(
    @InjectRepository(MedicalRecordAuditLog)
    private readonly auditRepository: Repository<MedicalRecordAuditLog>,
  ) {}

  @OnEvent(MEDICAL_AUDIT_EVENT, { async: true })
  async handleMedicalAuditLog(payload: MedicalAuditLogParams) {
    try {
      const log = this.auditRepository.create(payload);
      await this.auditRepository.save(log);
    } catch (error) {
      this.logger.error(
        `Failed to save medical audit log for action ${payload.action}`,
        error.stack,
      );
    }
  }
}
