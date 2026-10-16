import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { ClaimsException, ErrorCode } from '../../../common/exceptions/claims.exception';
import { toFileView } from '../../../common/utils/file-ref.util';
import { paginate } from '../../../common/utils/paginate.util';
import { compareBy, includesText, parseSort } from '../../../common/utils/query.util';
import { round2 } from '../../../domain/claim.constants';
import { coverBreakdown, coverItemOf, coverUsage, warrantyCap } from '../../../domain/cover';
import { priceCheck } from '../../../domain/pricing';
import {
  ApprovalRecord, ApprovalType, ClaimRecord, ClaimStatus, PartPriceRecord, QuoteRecord,
} from '../../../domain/claim.types';
import { MockDataStore } from '../../../store/mock-data.store';
import { AuditService } from '../../audit-logs/services/audit.service';
import { ClaimWorkflowService } from '../../claim-workflow/services/claim-workflow.service';
import { ConfigsService } from '../../configs/services/configs.service';
import { buildWarrantyCap, toQaView } from '../../claims/services/claim.mapper';
import { PaymentsService } from '../../payments/services/payments.service';
import { ApprovalDecisionDto, ListApprovalsQueryDto } from '../dto/approvals.dto';

const SORT_FIELDS = ['submitted_at', 'id', 'amount'];

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly store: MockDataStore,
    private readonly workflow: ClaimWorkflowService,
    private readonly payments: PaymentsService,
    private readonly configs: ConfigsService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── queries ─────────────────────────────

  list(query: ListApprovalsQueryDto) {
    const from = query.from ? new Date(query.from).getTime() : undefined;
    const to = query.to ? new Date(query.to).getTime() + 86_399_999 : undefined;
    const sort = parseSort(query.sort, SORT_FIELDS, { field: 'submitted_at', direction: 'asc' });

    const rows = this.store.approvals
      .filter((a) => a.type === query.type && a.status === query.status)
      .filter((a) => query.claimId === undefined || a.claimId === query.claimId)
      .map((a) => ({ approval: a, row: this.toRow(a) }))
      .filter(({ approval, row }) => {
        if (query.country && row.country !== query.country) return false;
        if (query.vendorId && row.vendor?.id !== query.vendorId) return false;
        if (query.overdue !== undefined && row.overdue !== query.overdue) return false;
        const at = new Date(approval.submittedAt).getTime();
        if (from !== undefined && at < from) return false;
        if (to !== undefined && at > to) return false;
        if (query.search && query.searchType) {
          const fields: Record<string, unknown> = {
            ID: row.id, CLAIM_ID: row.claimId, CUSTOMER_NAME: row.customer.name, CUSTOMER_EMAIL: row.customer.email,
            VENDOR: row.vendor?.name, DESCRIPTION: (row as { description?: string }).description,
            ACCOUNT_NAME: (row as { accountName?: string }).accountName,
          };
          return includesText(fields[query.searchType], query.search);
        }
        return true;
      })
      .sort(compareBy(sort, (entry, field) => (field === 'id' ? entry.approval.id : field === 'amount' ? entry.approval.amount : entry.approval.submittedAt)))
      .map(({ row }) => row);

    return paginate(rows, query.page, query.limit);
  }

  summary() {
    const pending = this.store.approvals.filter((a) => a.status === 'PENDING');
    const count = (type: ApprovalType) => pending.filter((a) => a.type === type).length;
    const oldest = [...pending].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))[0];
    return {
      DIAGNOSIS: count('DIAGNOSIS'),
      QUOTE: count('QUOTE'),
      QA_SIGNOFF: count('QA_SIGNOFF'),
      PAYMENT: count('PAYMENT'),
      oldestPendingAt: oldest?.submittedAt ?? null,
      // Counters the current Approvals tabs read.
      requestsCount: count('DIAGNOSIS'),
      quotesCount: count('QUOTE'),
      repairsCount: count('QA_SIGNOFF'),
    };
  }

  get(id: number, user: AuthUser) {
    const approval = this.require(id);
    if (approval.type === 'PAYMENT') return { ...this.payments.getApproval(id, user), type: 'PAYMENT' };

    const claim = this.requireClaim(approval.claimId);
    const base = {
      ...this.toRow(approval),
      claim: {
        id: claim.id, reference: claim.reference, claimType: claim.claimType, status: claim.status,
        customer: claim.customer, car: claim.car, vendor: claim.vendor ? { id: claim.vendor.id, name: claim.vendor.name } : null,
      },
      priorDeclines: this.store.approvals
        .filter((a) => a.claimId === claim.id && a.type === approval.type && a.status === 'DECLINED' && a.id !== approval.id)
        .map((a) => ({ id: a.id, decidedAt: a.decidedAt ?? null, decisionReason: a.decisionReason ?? null })),
      decision: this.decisionState(approval, user),
    };

    switch (approval.type) {
      case 'DIAGNOSIS':
        return { ...base, request: this.diagnosisDetail(claim, approval) };
      case 'QUOTE':
        return { ...base, ...this.quoteDetail(claim, approval) };
      default:
        return { ...base, repair: this.repairDetail(claim, approval) };
    }
  }

  // ───────────────────────────── decision ─────────────────────────────

  decide(id: number, dto: ApprovalDecisionDto, user: AuthUser, ifMatch?: number) {
    const approval = this.require(id);
    const approve = dto.decision === 'APPROVE';

    // Declines need a reason: same rule the approval-decision form enforces in the UI.
    this.configs.assertValid('approval-decision', { decision: dto.decision, reason: dto.reason });

    if (approval.type === 'PAYMENT') {
      if (!user.permissions.includes('payments:approve')) {
        throw ClaimsException.forbidden(ErrorCode.FORBIDDEN, 'Missing permission: payments:approve');
      }
      const result = this.payments.decideApproval(approval, approve, dto.reason ?? 'Approved', user, ifMatch);
      return { ...result, claimStatus: this.requireClaim(approval.claimId).status };
    }

    this.workflow.assertVersion(approval, ifMatch);
    if (approval.status !== 'PENDING') {
      throw ClaimsException.invalidTransition(`This approval has already been ${approval.status.toLowerCase()}`);
    }
    this.workflow.assertMakerChecker(approval, user);

    const claim = this.requireClaim(approval.claimId);
    const reason = dto.reason ?? 'Approved';
    this.applyEffects(approval, claim, approve, reason, user);

    const now = new Date().toISOString();
    Object.assign(approval, {
      status: approve ? 'APPROVED' : 'DECLINED', decidedBy: user.id, decidedByName: user.name ?? user.id,
      decidedAt: now, decisionReason: reason, version: approval.version + 1,
    });

    this.audit.record(
      {
        module: 'APPROVALS', action: `${approval.type}_${approve ? 'APPROVED' : 'DECLINED'}`, entityType: 'approval',
        entityId: approval.id, claimId: claim.id, severity: approve ? 'INFO' : 'WARNING',
        details: `${approve ? 'Approved' : 'Declined'} ${approval.subjectLabel} (${claim.reference})`,
        before: { status: 'PENDING' }, after: { status: approval.status, decidedBy: user.id },
      },
      user,
    );

    return {
      id: approval.id, status: approval.status, decidedBy: user.id, decidedByName: user.name ?? user.id,
      decidedAt: now, decisionReason: reason, claimStatus: claim.status,
    };
  }

  /** Per-type consequences of a decision on the claim, quote, QA inspection and payments. */
  private applyEffects(approval: ApprovalRecord, claim: ClaimRecord, approve: boolean, reason: string, user: AuthUser): void {
    switch (approval.type) {
      case 'DIAGNOSIS':
        this.workflow.assertStatus(claim, [ClaimStatus.PENDING_APPROVAL], 'decide the diagnosis request');
        this.workflow.transition(
          claim,
          approve ? ClaimStatus.DIAGNOSIS_IN_PROGRESS : ClaimStatus.CUSTOMER_SUBMITTED_FORM,
          approve
            ? { action: 'approve_diagnosis', actor: user, event: 'Diagnosis approved', message: 'Claims admin approved diagnosis — workshop may proceed.' }
            : { action: 'decline_diagnosis', actor: user, event: 'Diagnosis request declined', message: `Diagnosis request declined: ${reason}`, reason },
        );
        break;

      case 'QUOTE': {
        this.workflow.assertStatus(claim, [ClaimStatus.QUOTE_IN_REVIEW, ClaimStatus.QUOTATION_REVIEW_WITH_INSURANCE], 'decide the quote');
        const quote = this.store.quotes.find((q) => q.id === approval.subjectId)!;
        if (!approve) {
          quote.status = 'DECLINED';
          this.workflow.transition(claim, ClaimStatus.DIAGNOSIS_IN_PROGRESS, {
            action: 'decline_quote', actor: user, event: 'Quote declined', message: `Quote ${quote.invoiceNumber} declined: ${reason}. The workshop can submit a revised quote.`, reason,
          });
          break;
        }
        if (claim.claimType === 'WARRANTY') {
          const cap = buildWarrantyCap(claim, this.configs.getSettings().warrantyCapPercentage);
          if (quote.totalAmount > cap.remaining) {
            throw ClaimsException.unprocessable(ErrorCode.WARRANTY_CAP_EXCEEDED, `Quote of ${quote.totalAmount} exceeds the remaining warranty cap of ${cap.remaining}`, cap);
          }
          claim.warrantyCapUsedAmount = round2(claim.warrantyCapUsedAmount + quote.totalAmount);
        }
        quote.status = 'APPROVED';
        this.recordApprovedPrices(claim, quote);
        this.workflow.transition(claim, ClaimStatus.REPAIR_ONGOING, {
          action: 'approve_quote', actor: user, event: 'Quote approved', message: 'Repair quote approved — upfront payment raised for approval.',
        });
        // Approving a quote raises its upfront payment; there is no separate "request" step.
        this.payments.raise(claim, 'UPFRONT', user);
        break;
      }

      default: {
        this.workflow.assertStatus(claim, [ClaimStatus.QUALITY_CONTROL], 'decide the QC sign-off');
        if (claim.qa) {
          claim.qa.state = approve ? 'PASSED' : 'CORRECTIVE_ACTION_REQUIRED';
          if (!approve) claim.qa.failedItemCount += 1;
        }
        if (approve) {
          this.workflow.transition(claim, ClaimStatus.VEHICLE_READY, {
            action: 'approve_qa', actor: user, event: 'QC passed', message: 'Repair passed quality control — vehicle ready for pickup.',
          });
          this.payments.raise(claim, 'BALANCE', user);
        } else {
          this.workflow.transition(claim, ClaimStatus.REPAIR_ONGOING, {
            action: 'decline_qa', actor: user, event: 'QC failed', message: `Quality control failed: ${reason}. Corrective action required.`, reason,
          });
        }
      }
    }
  }

  /** Approved line prices feed the parts-pricing history used for future benchmarks. */
  private recordApprovedPrices(claim: ClaimRecord, quote: QuoteRecord): void {
    const car = claim.car;
    for (const line of quote.lineItems) {
      if (line.categoryCode === 'LABOUR') continue;
      const part: PartPriceRecord = {
        id: this.store.nextId('part'), partName: line.description, workshop: claim.vendor?.name ?? 'Workshop',
        vendorId: quote.vendorId, approvedPrice: line.unitAmount, currency: claim.currency, country: claim.country,
        carLabel: `${car.make} ${car.model} ${car.year}`, make: car.make, model: car.model, category: line.categoryCode,
        approvedDate: new Date().toISOString(), claimId: claim.id,
      };
      this.store.parts.push(part);
    }
  }

  // ───────────────────────────── detail builders ─────────────────────────────

  private diagnosisDetail(claim: ClaimRecord, approval: ApprovalRecord) {
    return {
      workshopProof: toFileView(approval.workshopProof),
      workshopProofUrl: approval.workshopProof?.url ?? null,
      jobOrderNumber: claim.jobOrderNumber,
      createdAt: claim.createdAt,
      createdBy: claim.createdBy,
      requestChannel: claim.requestChannel ?? null,
      reportedIssue: claim.initialDetails ?? null,
      issueSubType: claim.issueSubType,
      submission: claim.scheduling ?? null,
    };
  }

  private quoteDetail(claim: ClaimRecord, approval: ApprovalRecord) {
    const quote = this.store.quotes.find((q) => q.id === approval.subjectId)!;
    const used = coverUsage(this.store, claim.car.id);
    const breakdown = coverBreakdown(this.store, claim.car.id);
    const settings = this.configs.getSettings();

    return {
      quote: {
        id: quote.id, revision: quote.revision, kind: quote.kind, status: quote.status,
        invoiceNumber: quote.invoiceNumber, upfrontAmount: quote.upfrontAmount, totalAmount: quote.totalAmount,
        currency: quote.currency, submittedAt: quote.submittedAt, submittedBy: quote.submittedBy,
        issueTypes: quote.issueTypes, diagnosisNotes: quote.diagnosisNotes ?? null,
        subTotal: round2(quote.lineItems.reduce((sum, l) => sum + l.amount, 0)),
        lineItems: quote.lineItems.map((line) => {
          const cover = breakdown.items.find((c) => c.item === coverItemOf(line));
          return {
            ...line,
            qaApplicable: line.categoryCode !== 'LABOUR',
            insurerCovered: claim.claimType === 'INSURANCE' && line.categoryCode !== 'LABOUR',
            priceCheck: priceCheck(this.store, line.description, line.unitAmount, claim.country),
            coverCheck: cover
              ? { covered: true, limit: cover.limit, used: used.get(cover.item) ?? 0, remaining: cover.remaining }
              : { covered: false, limit: null, used: null, remaining: null },
          };
        }),
        documents: {
          diagnosisReport: toFileView(quote.diagnosisReport),
          scanReport: toFileView(quote.scanReport),
          invoice: toFileView(quote.invoice),
        },
      },
      warrantyCap: warrantyCap(claim.car.price, claim.warrantyCapUsedAmount, settings.warrantyCapPercentage),
      coverBreakdown: {
        totalLimit: breakdown.totalLimit,
        totalUsed: breakdown.totalUsed,
        totalRemaining: breakdown.totalRemaining,
        byCategory: breakdown.items.filter((c) => c.used > 0).map((c) => ({ category: c.item, limit: c.limit, used: c.used, remaining: c.remaining })),
      },
    };
  }

  private repairDetail(claim: ClaimRecord, approval: ApprovalRecord) {
    const quote = this.store.quotes.find((q) => q.id === claim.quoteId);
    const lines = quote?.lineItems ?? [];
    const labour = round2(lines.filter((l) => l.categoryCode === 'LABOUR').reduce((sum, l) => sum + l.amount, 0));
    return {
      invoiceNumber: quote?.invoiceNumber ?? null,
      completedAt: claim.repairCompletionProof?.submittedAt ?? approval.submittedAt,
      technician: claim.qa?.assignedInspector ?? null,
      partsAmount: round2((quote?.totalAmount ?? 0) - labour),
      labourAmount: labour,
      issueTypes: quote?.issueTypes ?? claim.issueTypes,
      diagnosisReport: toFileView(quote?.diagnosisReport),
      scanReport: toFileView(quote?.scanReport),
      diagnosisNotes: quote?.diagnosisNotes ?? null,
      afterImage: toFileView(claim.repairCompletionProof?.file),
      afterImageUrl: claim.repairCompletionProof?.file.url ?? null,
      qa: toQaView(claim),
    };
  }

  // ───────────────────────────── shared ─────────────────────────────

  private decisionState(approval: ApprovalRecord, user: AuthUser) {
    let reasonIfNot: string | null = null;
    if (approval.status !== 'PENDING') reasonIfNot = `Already ${approval.status.toLowerCase()}`;
    else if (!user.permissions.includes('reviews:approve')) reasonIfNot = 'You do not have permission to decide this';
    else if (approval.submittedBy === user.id) {
      try {
        this.workflow.assertMakerChecker(approval, user);
      } catch {
        reasonIfNot = 'You submitted this request, so another approver must decide it';
      }
    }
    return { canDecide: reasonIfNot === null, reasonIfNot, requiresSecondApprover: false, secondApproverState: null };
  }

  private toRow(approval: ApprovalRecord) {
    if (approval.type === 'PAYMENT') {
      return { ...this.payments.toApprovalRow(approval), type: 'PAYMENT' as const, vendor: this.vendorOf(this.requireClaim(approval.claimId)) };
    }
    const claim = this.requireClaim(approval.claimId);
    const quote = this.store.quotes.find((q) => q.id === claim.quoteId);
    return {
      id: approval.id,
      type: approval.type,
      status: approval.status,
      claimId: claim.id,
      claimReference: claim.reference,
      subjectId: approval.subjectId,
      subjectLabel: approval.subjectLabel,
      submittedBy: approval.submittedBy,
      submittedByName: approval.submittedByName,
      submittedAt: approval.submittedAt,
      overdue: approval.status === 'PENDING' && new Date(approval.overdueAt) < new Date(),
      overdueAt: approval.overdueAt,
      amount: approval.amount ?? null,
      currency: approval.currency ?? claim.currency,
      decidedBy: approval.decidedBy ?? null,
      decidedByName: approval.decidedByName ?? null,
      decidedAt: approval.decidedAt ?? null,
      decisionReason: approval.decisionReason ?? null,
      // Fields the current Claims UI review tables read.
      customer: claim.customer,
      car: claim.car,
      vendor: this.vendorOf(claim),
      country: claim.country,
      claimType: claim.claimType,
      claimStatus: claim.status,
      upfrontAmount: approval.type === 'QUOTE' ? (quote?.upfrontAmount ?? null) : null,
      totalAmount: approval.type === 'QUOTE' ? (quote?.totalAmount ?? null) : null,
      workshopProofUrl: approval.workshopProof?.url ?? null,
      afterImageUrl: claim.repairCompletionProof?.file.url ?? null,
      issueTypes: quote?.issueTypes ?? claim.issueTypes,
      schedule: claim.appointmentDate ?? claim.claimsDate,
      repairAmount: approval.type === 'QA_SIGNOFF' ? (claim.totalAmount ?? 0) : null,
      vat: 0,
    };
  }

  private vendorOf(claim: ClaimRecord) {
    return claim.vendor ? { id: claim.vendor.id, name: claim.vendor.name, country: claim.vendor.country } : null;
  }

  private require(id: number): ApprovalRecord {
    const approval = this.store.approvals.find((a) => a.id === id);
    if (!approval) throw ClaimsException.notFound('Approval', id);
    return approval;
  }

  private requireClaim(id: number): ClaimRecord {
    const claim = this.store.findClaim(id);
    if (!claim) throw ClaimsException.notFound('Claim', id);
    return claim;
  }
}
