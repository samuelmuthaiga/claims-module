import { Injectable } from '@nestjs/common';
import { Paginated } from '../../../common/dto/pagination-response.dto';
import { ClaimsException } from '../../../common/exceptions/claims.exception';
import { paginate } from '../../../common/utils/paginate.util';
import { includesText } from '../../../common/utils/query.util';
import { AuditLogRecord } from '../../../domain/claim.types';
import { ENUMS } from '../../../domain/enums';
import { MockDataStore } from '../../../store/mock-data.store';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';

const entityTypeLabel = (type: string): string =>
  ENUMS.auditEntityTypes.find((o) => o.value === type)?.label ?? type;

const toView = (log: AuditLogRecord) => ({
  id: log.id,
  timestamp: log.timestamp,
  actorId: log.actorId,
  actorName: log.actorName,
  actorRole: log.actorRole,
  actorIp: log.actorIp,
  module: log.module,
  action: log.action,
  entityType: log.entityType,
  entityTypeLabel: entityTypeLabel(log.entityType),
  entityId: log.entityId,
  claimId: log.claimId ?? null,
  severity: log.severity,
  details: log.details,
  // Aliases used by the current Claims UI table.
  performedBy: log.actorName,
  role: log.actorRole,
});

@Injectable()
export class AuditLogsService {
  constructor(private readonly store: MockDataStore) {}

  list(query: AuditLogQueryDto): Paginated<ReturnType<typeof toView>> {
    const from = query.from ? new Date(query.from).getTime() : undefined;
    const to = query.to ? new Date(query.to).getTime() + 86_399_999 : undefined;
    const wantedType = query.entityType?.toLowerCase();

    const rows = this.store.audit
      .filter((log) => {
        if (query.module && log.module !== query.module) return false;
        if (query.action && log.action !== query.action) return false;
        if (query.severity && log.severity !== query.severity) return false;
        if (query.entityId && log.entityId !== query.entityId) return false;
        if (query.claimId !== undefined && log.claimId !== query.claimId) return false;
        if (wantedType && log.entityType !== wantedType && entityTypeLabel(log.entityType).toLowerCase() !== wantedType) return false;
        const at = new Date(log.timestamp).getTime();
        if (from !== undefined && at < from) return false;
        if (to !== undefined && at > to) return false;
        if (query.search && query.searchType) {
          const fields: Record<string, unknown> = {
            LOG_ID: log.id, ACTION: log.action, PERFORMED_BY: log.actorName, ENTITY_ID: log.entityId,
          };
          return includesText(fields[query.searchType], query.search);
        }
        return true;
      })
      .sort((a, b) => b.seq - a.seq);

    const page = paginate(rows, query.page, query.limit);
    return { data: page.data.map(toView), meta: page.meta };
  }

  summary() {
    const tally = (pick: (log: AuditLogRecord) => string) =>
      this.store.audit.reduce<Record<string, number>>((acc, log) => {
        acc[pick(log)] = (acc[pick(log)] ?? 0) + 1;
        return acc;
      }, {});
    return {
      totalEvents: this.store.audit.length,
      byModule: tally((l) => l.module),
      byAction: tally((l) => l.action),
      bySeverity: tally((l) => l.severity),
    };
  }

  get(id: string) {
    const log = this.store.audit.find((entry) => entry.id === id);
    if (!log) throw ClaimsException.notFound('Audit log', id);
    return { ...toView(log), before: log.before ?? null, after: log.after ?? null, requestId: log.requestId ?? null, chainHash: log.hash, previousHash: log.prevHash };
  }

  /** Recomputes the hash chain; false means the trail was tampered with. */
  verifyChain(): boolean {
    return this.store.audit.every((log, index) => index === 0 || log.prevHash === this.store.audit[index - 1]!.hash);
  }
}
