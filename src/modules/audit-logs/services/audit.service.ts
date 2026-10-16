import { Injectable } from '@nestjs/common';
import { primaryRole } from '../../../auth/constants/permissions';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { requestContext } from '../../../common/context/request-context';
import { AuditSeverity } from '../../../domain/claim.types';
import { MockDataStore } from '../../../store/mock-data.store';

export interface AuditEntry {
  module: 'CLAIMS' | 'APPROVALS' | 'PAYMENTS' | 'CONFIGS';
  action: string;
  entityType: 'claim' | 'quote' | 'approval' | 'payment' | 'config';
  entityId: string | number;
  claimId?: number;
  details: string;
  severity?: AuditSeverity;
  before?: unknown;
  after?: unknown;
}

/** Writes to the immutable, hash-chained audit trail. Never throws into business flows. */
@Injectable()
export class AuditService {
  constructor(private readonly store: MockDataStore) {}

  record(entry: AuditEntry, actor?: Pick<AuthUser, 'id' | 'name' | 'roles'>): void {
    const ctx = requestContext.getStore();
    this.store.appendAudit({
      timestamp: new Date().toISOString(),
      actorId: actor?.id ?? 'system',
      actorName: actor?.name ?? (actor ? actor.id : 'System'),
      actorRole: actor ? primaryRole(actor.roles) : 'SYSTEM',
      actorIp: ctx?.ip ?? 'internal',
      module: entry.module,
      action: entry.action,
      entityType: entry.entityType,
      entityId: String(entry.entityId),
      claimId: entry.claimId,
      severity: entry.severity ?? 'INFO',
      details: entry.details,
      before: entry.before,
      after: entry.after,
      requestId: ctx?.requestId,
    });
  }
}
