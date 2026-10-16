import { Injectable } from '@nestjs/common';
import { Permission, primaryRole } from '../../../auth/constants/permissions';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { AppConfigService } from '../../../config/app-config.service';
import { ClaimsException, ErrorCode } from '../../../common/exceptions/claims.exception';
import { CLAIM_STATUS_LABELS, statusLabel } from '../../../domain/claim.constants';
import {
  ApprovalRecord, ClaimRecord, ClaimStatus, ClaimStatusCode, TERMINAL_STATUSES, TimelineRecord,
} from '../../../domain/claim.types';
import { MockDataStore } from '../../../store/mock-data.store';
import { AuditService } from '../../audit-logs/services/audit.service';
import { ConfigsService } from '../../configs/services/configs.service';

export type Actor = Pick<AuthUser, 'id' | 'roles'> & { name?: string };

export interface TransitionOptions {
  action: string;
  actor: Actor;
  event: string;
  message?: string;
  reason?: string | null;
  channel?: TimelineRecord['channel'];
}

export interface RailStep {
  code: string;
  label: string;
  state: 'DONE' | 'CURRENT' | 'UPCOMING';
  at: string | null;
  by: string | null;
}

export interface AvailableAction {
  action: string;
  label: string;
  enabled: boolean;
  disabledReason: string | null;
  inputSchemaRef: string | null;
  requiresReason: boolean;
  endpoint: string;
  method: string;
}

/**
 * The claim state machine. Every claim mutation goes through here so status
 * history, timeline, audit trail and optimistic versioning are written the
 * same way no matter which endpoint triggered the change. Which actions are
 * offered in which status, and the rail shown to users, come from the
 * `claim-workflow` config rather than being hard-coded.
 */
@Injectable()
export class ClaimWorkflowService {
  constructor(
    private readonly store: MockDataStore,
    private readonly configs: ConfigsService,
    private readonly audit: AuditService,
    private readonly appConfig: AppConfigService,
  ) {}

  // ───────────────────────────── guards ─────────────────────────────

  assertVersion(entity: { version: number }, expected: number | undefined): void {
    if (expected !== undefined && expected !== entity.version) {
      throw ClaimsException.versionConflict(expected, entity.version);
    }
  }

  /** Throws 409 INVALID_TRANSITION unless the claim is in one of the allowed statuses. */
  assertStatus(claim: ClaimRecord, allowed: ClaimStatusCode[], action: string): void {
    if (allowed.includes(claim.status)) return;
    const expected = allowed.map((code) => statusLabel(code)).join(' or ');
    throw ClaimsException.invalidTransition(
      `Cannot ${action.replace(/_/g, ' ')} while the claim is '${statusLabel(claim.status)}' (requires ${expected})`,
    );
  }

  /** Maker-checker: the person who submitted an approval cannot decide it. */
  assertMakerChecker(approval: ApprovalRecord, user: AuthUser): void {
    if (!this.appConfig.getConfig().workflow.makerCheckerEnabled) return;
    if (approval.submittedBy === user.id) {
      throw ClaimsException.forbidden(
        ErrorCode.MAKER_CHECKER_VIOLATION,
        'The person who submitted this item cannot approve or decline it',
      );
    }
  }

  requiresPaymentSplit(claim: ClaimRecord): boolean {
    return claim.claimType === 'WARRANTY' || claim.repairFinanced;
  }

  isTerminal(status: ClaimStatusCode): boolean {
    return TERMINAL_STATUSES.includes(status);
  }

  // ───────────────────────────── transitions ─────────────────────────────

  transition(claim: ClaimRecord, to: ClaimStatusCode, options: TransitionOptions): void {
    const from = claim.status;
    const now = new Date().toISOString();
    const actorName = options.actor.name ?? options.actor.id;
    const role = primaryRole(options.actor.roles);

    claim.status = to;
    claim.version += 1;
    claim.updatedAt = now;
    claim.updatedBy = options.actor.id;

    this.store.history.push({
      id: this.store.nextId('history'),
      claimId: claim.id,
      fromStatus: from,
      toStatus: to,
      action: options.action,
      actorId: options.actor.id,
      actorRole: role,
      reason: options.reason ?? null,
      occurredAt: now,
    });
    this.log(claim, options.event, options.message ?? `Status changed to ${statusLabel(to)}`, options.actor, options.channel);

    this.audit.record(
      {
        module: 'CLAIMS',
        action: options.action.toUpperCase(),
        entityType: 'claim',
        entityId: claim.id,
        claimId: claim.id,
        details: `${options.event} on ${claim.reference}: ${statusLabel(from)} → ${statusLabel(to)}`,
        severity: to === ClaimStatus.CANCELLED ? 'WARNING' : 'INFO',
        before: { status: from },
        after: { status: to },
      },
      { id: options.actor.id, name: actorName, roles: options.actor.roles },
    );
  }

  /** Adds a timeline entry without changing status (e.g. a link was resent). */
  log(
    claim: ClaimRecord,
    event: string,
    message: string,
    actor: Actor,
    channel: TimelineRecord['channel'] = 'System',
  ): void {
    this.store.timeline.push({
      id: this.store.nextId('timeline'),
      claimId: claim.id,
      event,
      channel,
      message,
      timestamp: new Date().toISOString(),
      actor: { id: actor.id, name: actor.name ?? actor.id, role: primaryRole(actor.roles) },
    });
  }

  /** Opens a pending approval for a claim (diagnosis, quote, QC or payment). */
  raiseApproval(
    claim: ClaimRecord,
    type: ApprovalRecord['type'],
    subjectId: number,
    subjectLabel: string,
    actor: Actor,
    extra: Partial<ApprovalRecord> = {},
  ): ApprovalRecord {
    const now = new Date();
    const approval: ApprovalRecord = {
      id: this.store.nextId('approval'),
      type,
      status: 'PENDING',
      claimId: claim.id,
      subjectId,
      subjectLabel,
      submittedBy: actor.id,
      submittedByName: actor.name ?? actor.id,
      submittedAt: now.toISOString(),
      overdueAt: new Date(now.getTime() + this.configs.getSettings().approvalSlaHours * 3_600_000).toISOString(),
      version: 1,
      ...extra,
    };
    this.store.approvals.push(approval);
    return approval;
  }

  touch(claim: ClaimRecord, actor: Actor): void {
    claim.version += 1;
    claim.updatedAt = new Date().toISOString();
    claim.updatedBy = actor.id;
  }

  // ───────────────────────────── presentation ─────────────────────────────

  /** Rail for the claim's type, with per-step state derived from status history. */
  buildRail(claim: ClaimRecord): RailStep[] {
    const workflow = this.configs.getWorkflow();
    const codes: string[] = [...(workflow.rails[claim.claimType] ?? workflow.rails['REPAIRS'] ?? [])];

    // Repair-financed repairs also agree a split before review.
    if (claim.repairFinanced && !codes.includes(ClaimStatus.QUOTE_SUBMITTED)) {
      const after = codes.indexOf(ClaimStatus.DIAGNOSIS_IN_PROGRESS);
      if (after >= 0) codes.splice(after + 1, 0, ClaimStatus.QUOTE_SUBMITTED);
    }

    const history = this.store.history.filter((h) => h.claimId === claim.id);
    const reached = new Map(history.map((h) => [h.toStatus as string, h]));
    const cancelled = claim.status === ClaimStatus.CANCELLED;

    // The step the claim is "at": its status, or for a status that is not a
    // rail step (e.g. cancelled) the last rail step it actually reached.
    const lastOnRail = [...history].reverse().find((h) => codes.includes(h.toStatus));
    const anchor = codes.includes(claim.status) ? claim.status : (lastOnRail?.toStatus ?? codes[0]!);
    const anchorIndex = Math.max(codes.indexOf(anchor), 0);

    const rail = cancelled ? [...codes.slice(0, anchorIndex + 1), ClaimStatus.CANCELLED as string] : codes;
    const currentIndex = cancelled ? rail.length - 1 : anchorIndex;

    return rail.map((code, index) => {
      const hit = reached.get(code);
      return {
        code,
        label: CLAIM_STATUS_LABELS[code as ClaimStatusCode] ?? code,
        state: index === currentIndex ? 'CURRENT' : index < currentIndex ? 'DONE' : 'UPCOMING',
        at: hit?.occurredAt ?? null,
        by: hit?.actorId ?? null,
      } satisfies RailStep;
    });
  }

  availableActions(claim: ClaimRecord, user: Pick<AuthUser, 'permissions'>): AvailableAction[] {
    const workflow = this.configs.getWorkflow();
    return workflow.actions
      .filter((def) => !def.claimTypes || def.claimTypes.includes(claim.claimType))
      .map((def) => {
        const statusOk = def.from.includes(claim.status);
        const permitted = user.permissions.includes(def.permission);
        let disabledReason: string | null = null;
        if (!statusOk) {
          disabledReason = this.isTerminal(claim.status)
            ? `Claim is ${statusLabel(claim.status)}`
            : `Available when the claim is ${def.from.map(statusLabel).join(' or ')}`;
        } else if (!permitted) {
          disabledReason = 'You do not have permission to perform this action';
        }
        return {
          action: def.action,
          label: def.label,
          enabled: statusOk && permitted,
          disabledReason,
          inputSchemaRef: def.inputSchemaRef,
          requiresReason: Boolean(def.requiresReason),
          endpoint: def.endpoint.replace(':id', String(claim.id)),
          method: def.method,
        };
      });
  }

  /** The approval queue item a claim is waiting on, if any (lets the rail deep-link to the decision). */
  reviewTarget(claim: ClaimRecord): { label: string; type: string; id: number } | null {
    const target = this.configs.getWorkflow().reviewTargets[claim.status];
    if (!target) return null;
    const approval = this.store.approvals.find(
      (a) => a.claimId === claim.id && a.type === target.approvalType && a.status === 'PENDING',
    );
    return approval ? { label: target.label, type: target.approvalType, id: approval.id } : null;
  }

  canManage(user: Pick<AuthUser, 'permissions'>): boolean {
    return user.permissions.includes(Permission.CLAIMS_WRITE);
  }
}
