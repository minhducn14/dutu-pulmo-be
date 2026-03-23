import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditEntityType } from './enums/audit-entity-type.enum';
import { AuditActorRole } from './enums/audit-actor-role.enum';
import { AuditAction } from './enums/audit-action.enum';

export const MEDICAL_AUDIT_EVENT = 'medical.audit.log';

export interface MedicalAuditLogParams {
  entityType: AuditEntityType;
  entityId: string;
  medicalRecordId?: string;
  patientId: string;
  actorId: string;
  actorRole: AuditActorRole;
  action: AuditAction;
  metadata?: Record<string, any>;
}

@Injectable()
export class MedicalAuditService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Log a medical audit event asynchronously.
   * This is non-blocking.
   */
  log(params: MedicalAuditLogParams): void {
    this.eventEmitter.emit(MEDICAL_AUDIT_EVENT, params);
  }
}
