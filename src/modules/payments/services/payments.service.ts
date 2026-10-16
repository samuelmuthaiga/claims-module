import { Injectable } from '@nestjs/common';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { Paginated } from '../../../common/dto/pagination-response.dto';
import { ClaimsException, ErrorCode } from '../../../common/exceptions/claims.exception';
import { AppConfigService } from '../../../config/app-config.service';
import { paginate } from '../../../common/utils/paginate.util';
import { includesText } from '../../../common/utils/query.util';
import { round2 } from '../../../domain/claim.constants';
import {
  ApprovalRecord, ClaimRecord, PaymentKind, PaymentRecord, PaymentStatus,
} from '../../../domain/claim.types';
import { vendorBank } from '../../../domain/vendor-bank';
import { MockDataStore } from '../../../store/mock-data.store';
import { AuditService } from '../../audit-logs/services/audit.service';
import { ClaimWorkflowService } from '../../claim-workflow/services/claim-workflow.service';
import { ConfigContextService } from '../../configs/services/config-context.service';
import { ConfigsService } from '../../configs/services/configs.service';
import {
  ListPaymentApprovalsQueryDto, ListPaymentsQueryDto, PaymentActionDto, RequestPaymentDto,
} from '../dto/payments.dto';

const OPEN_STATUSES: PaymentStatus[] = ['PENDING', 'PENDING_APPROVAL', 'DISPUTED'];
const kindFor = (list: 'quotes' | 'repairs'): PaymentKind => (list === 'quotes' ? 'UPFRONT' : 'BALANCE');
const VENDOR_NAME_FALLBACK = 'Workshop';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly store: MockDataStore,
    private readonly workflow: ClaimWorkflowService,
    private readonly configs: ConfigsService,
    private readonly contexts: ConfigContextService,
    private readonly audit: AuditService,
    private readonly appConfig: AppConfigService,
  ) {}

  // ───────────────────────────── queries ─────────────────────────────

  summary() {
    const open = (kind: PaymentKind) =>
      this.store.payments.filter((p) => p.kind === kind && OPEN_STATUSES.includes(p.status)).length;
    return {
      pendingQuotes: open('UPFRONT'),
      pendingRepairs: open('BALANCE'),
      pendingApprovals: this.store.approvals.filter((a) => a.type === 'PAYMENT' && a.status === 'PENDING').length,
    };
  }

  list(list: 'quotes' | 'repairs', query: ListPaymentsQueryDto): Paginated<ReturnType<PaymentsService['toRow']>> {
    const rows = this.store.payments
      .filter((p) => p.kind === kindFor(list))
      .map((p) => this.toRow(p))
      .filter((row) => {
        if (query.paymentStatus && row.status !== query.paymentStatus) return false;
        if (query.country && row.country !== query.country) return false;
        if (query.vendorId && row.payeeVendorId !== query.vendorId) return false;
        if (query.search && query.searchType) {
          const fields: Record<string, unknown> = {
            ID: row.id, CUSTOMER_NAME: row.customer.name, CUSTOMER_EMAIL: row.customer.email, VENDOR: row.payeeVendorName,
          };
          return includesText(fields[query.searchType], query.search);
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return paginate(rows, query.page, query.limit);
  }

  get(list: 'quotes' | 'repairs', id: number) {
    const payment = this.store.payments.find((p) => p.id === id && p.kind === kindFor(list));
    if (!payment) throw ClaimsException.notFound('Payment', id);
    const vendor = this.store.vendors.find((v) => v.id === payment.vendorId);
    const approval = payment.approvalId ? this.store.approvals.find((a) => a.id === payment.approvalId) : undefined;
    return {
      ...this.toRow(payment),
      payeeAccount: vendor ? vendorBank(vendor) : null,
      approvalStatus: approval?.status ?? null,
      statusReason: payment.statusReason ?? null,
    };
  }

  listApprovals(query: ListPaymentApprovalsQueryDto) {
    const rows = this.store.approvals
      .filter((a) => a.type === 'PAYMENT' && a.status === query.status)
      .map((a) => this.toApprovalRow(a))
      .filter((row) => {
        if (query.country && row.country !== query.country) return false;
        if (query.search && query.searchType) {
          const fields: Record<string, unknown> = {
            ID: row.id, CUSTOMER_NAME: row.customer.name, DESCRIPTION: row.description, ACCOUNT_NAME: row.accountName,
          };
          return includesText(fields[query.searchType], query.search);
        }
        return true;
      })
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
    return paginate(rows, query.page, query.limit);
  }

  getApproval(id: number, user: Pick<AuthUser, 'id' | 'permissions'>) {
    const approval = this.requireApproval(id);
    const payment = this.requirePayment(approval.paymentId!);
    const claim = this.requireClaim(payment.claimId);
    const vendor = this.store.vendors.find((v) => v.id === payment.vendorId);
    const { vatRate, serviceChargeRate } = this.configs.getSettings().payment;
    const quote = this.store.quotes.find((q) => q.id === claim.quoteId);
    const vat = round2((payment.amount * vatRate) / (1 + vatRate));
    const serviceCharge = round2(payment.amount * serviceChargeRate);

    return {
      ...this.toApprovalRow(approval),
      car: claim.car,
      vendor: vendor ?? null,
      invoiceUrl: quote?.invoice.url ?? null,
      grossAmount: payment.amount,
      vat,
      serviceCharge,
      netPayable: round2(payment.amount - serviceCharge),
      requestedBy: approval.submittedByName,
      approvedQuoteAmount: quote?.totalAmount ?? null,
      bank: vendor ? vendorBank(vendor) : null,
      decision: this.decisionState(approval, payment, user),
    };
  }

  // ───────────────────────────── commands ─────────────────────────────

  request(dto: RequestPaymentDto, user: AuthUser) {
    const payment = this.store.payments.find((p) => p.id === dto.id && p.kind === kindFor(dto.list));
    if (!payment) throw ClaimsException.notFound('Payment', dto.id);
    if (payment.status !== 'PENDING' && payment.status !== 'INVOICE_DECLINED') {
      throw ClaimsException.invalidTransition(`A payment that is '${payment.status}' cannot be requested again`);
    }
    const claim = this.requireClaim(payment.claimId);

    const split = { ...dto.paymentSplit, repairFinancing: dto.paymentSplit.repairFinancing ?? 0 };
    this.configs.assertValid(
      'payment-request',
      { invoiceNumber: dto.invoiceNumber, amount: dto.amount, paymentSplit: split },
      this.contexts.claimContext(claim),
    );

    Object.assign(payment, {
      amount: dto.amount, invoiceNumber: dto.invoiceNumber, paymentSplit: split,
      status: 'PENDING_APPROVAL', requestedBy: user.id, statusReason: undefined, updatedAt: new Date().toISOString(),
    });
    const approval = this.workflow.raiseApproval(claim, 'PAYMENT', payment.id, this.paymentLabel(payment), user, {
      paymentId: payment.id, amount: payment.amount, currency: payment.currency,
    });
    payment.approvalId = approval.id;

    this.workflow.log(claim, 'Payment requested', `${payment.kind === 'UPFRONT' ? 'Upfront' : 'Balance'} payment of ${payment.amount} ${payment.currency} requested.`, user);
    this.audit.record(
      { module: 'PAYMENTS', action: 'PAYMENT_REQUESTED', entityType: 'payment', entityId: payment.id, claimId: claim.id, details: `Requested payment ${payment.invoiceNumber} for ${payment.amount} ${payment.currency}`, after: { status: payment.status } },
      user,
    );
    return { paymentId: payment.id, approvalId: approval.id, status: 'PENDING' };
  }

  action(dto: PaymentActionDto, user: AuthUser, ifMatch?: number) {
    this.configs.assertValid('payment-action', { reason: dto.reason });

    if (dto.list === 'approvals') {
      const approval = this.requireApproval(dto.id);
      return this.decideApproval(approval, dto.approve === true, dto.reason, user, ifMatch);
    }

    const payment = this.store.payments.find((p) => p.id === dto.id && p.kind === kindFor(dto.list as 'quotes' | 'repairs'));
    if (!payment) throw ClaimsException.notFound('Payment', dto.id);
    if (!OPEN_STATUSES.includes(payment.status)) {
      throw ClaimsException.invalidTransition(`A payment that is '${payment.status}' can no longer be actioned`);
    }

    // A payment waiting in the approvals queue is decided there, so the queue and the list never disagree.
    const approval = payment.approvalId ? this.store.approvals.find((a) => a.id === payment.approvalId) : undefined;
    if (approval?.status === 'PENDING' && dto.newStatus !== 'DISPUTED') {
      return this.decideApproval(approval, dto.newStatus === 'APPROVED', dto.reason, user, ifMatch);
    }

    payment.status = dto.newStatus as PaymentStatus;
    payment.statusReason = dto.reason;
    payment.updatedAt = new Date().toISOString();
    this.audit.record(
      { module: 'PAYMENTS', action: `PAYMENT_${payment.status}`, entityType: 'payment', entityId: payment.id, claimId: payment.claimId, severity: payment.status === 'DISPUTED' ? 'WARNING' : 'INFO', details: `Payment ${payment.invoiceNumber} marked ${payment.status}: ${dto.reason}` },
      user,
    );
    return {
      id: payment.id, status: payment.status, decidedBy: user.id, decidedByName: user.name ?? user.id,
      decidedAt: payment.updatedAt, decisionReason: dto.reason, paymentStatus: payment.status,
      walletReference: payment.walletReference ?? null,
    };
  }

  /** Auto-raised when a quote is approved (UPFRONT) or QC passes (BALANCE). */
  raise(claim: ClaimRecord, kind: PaymentKind, actor: Pick<AuthUser, 'id' | 'roles'> & { name?: string }): PaymentRecord | undefined {
    const quote = this.store.quotes.find((q) => q.id === claim.quoteId);
    if (!quote) return undefined;
    const amount = kind === 'UPFRONT' ? quote.upfrontAmount : round2(quote.totalAmount - quote.upfrontAmount);
    if (amount <= 0) return undefined;

    const now = new Date().toISOString();
    const payment: PaymentRecord = {
      id: this.store.nextId('payment'), claimId: claim.id, kind, status: 'PENDING_APPROVAL', amount,
      currency: claim.currency, invoiceNumber: kind === 'UPFRONT' ? quote.invoiceNumber : `RPR-${String(claim.id).padStart(5, '0')}`,
      vendorId: quote.vendorId, paymentSplit: { ...claim.paymentSplit }, requestedBy: actor.id, createdAt: now, updatedAt: now,
    };
    this.store.payments.push(payment);
    const approval = this.workflow.raiseApproval(claim, 'PAYMENT', payment.id, this.paymentLabel(payment), actor, {
      paymentId: payment.id, amount, currency: claim.currency,
    });
    payment.approvalId = approval.id;
    this.workflow.log(claim, `${kind === 'UPFRONT' ? 'Upfront' : 'Balance'} payment raised`, `${amount} ${claim.currency} raised for approval.`, actor);
    return payment;
  }

  /** Decides a PAYMENT approval; shared by `POST /payments/action` and `POST /approvals/:id/decision`. */
  decideApproval(approval: ApprovalRecord, approve: boolean, reason: string, user: AuthUser, ifMatch?: number) {
    if (approval.type !== 'PAYMENT') throw ClaimsException.invalidTransition('Not a payment approval');
    this.workflow.assertVersion(approval, ifMatch);
    if (approval.status !== 'PENDING') {
      throw ClaimsException.invalidTransition(`This approval has already been ${approval.status.toLowerCase()}`);
    }
    this.workflow.assertMakerChecker(approval, user);

    const payment = this.requirePayment(approval.paymentId!);
    const claim = this.requireClaim(payment.claimId);
    const now = new Date().toISOString();
    const decider = { name: user.name ?? user.id };

    // Large payments need two different approvers (dual control).
    const dual = approve && this.requiresSecondApprover(payment);
    if (dual && !approval.firstApprovedBy) {
      approval.firstApprovedBy = user.id;
      approval.version += 1;
      this.audit.record(
        { module: 'PAYMENTS', action: 'PAYMENT_FIRST_APPROVAL', entityType: 'approval', entityId: approval.id, claimId: claim.id, details: `First approval of payment ${payment.invoiceNumber}; awaiting a second approver` },
        user,
      );
      return {
        id: approval.id, status: 'PENDING', decidedBy: null, decidedByName: null, decidedAt: null, decisionReason: null,
        paymentStatus: payment.status, walletReference: null, secondApproverState: 'AWAITING_SECOND',
      };
    }
    if (dual && approval.firstApprovedBy === user.id && this.appEnforcesDualControl()) {
      throw ClaimsException.forbidden(ErrorCode.MAKER_CHECKER_VIOLATION, 'A different approver must give the second approval');
    }

    approval.status = approve ? 'APPROVED' : 'DECLINED';
    approval.decidedBy = user.id;
    approval.decidedByName = decider.name;
    approval.decidedAt = now;
    approval.decisionReason = reason;
    approval.version += 1;

    payment.status = approve ? 'APPROVED' : 'INVOICE_DECLINED';
    payment.statusReason = reason;
    payment.updatedAt = now;
    // Disbursement happens through the wallet service once it is integrated; the reference marks the instruction.
    if (approve) payment.walletReference = `WALLET-REF-${Date.now().toString().slice(-8)}`;

    this.workflow.log(
      claim,
      approve ? `${payment.kind === 'UPFRONT' ? 'Upfront' : 'Balance'} payment approved` : 'Payment declined',
      approve ? (payment.kind === 'UPFRONT' ? 'Upfront payment approved — repair work can begin.' : 'Balance payment approved.') : `Payment declined: ${reason}`,
      user,
    );
    this.audit.record(
      { module: 'PAYMENTS', action: approve ? 'PAYMENT_APPROVED' : 'PAYMENT_DECLINED', entityType: 'approval', entityId: approval.id, claimId: claim.id, severity: approve ? 'INFO' : 'WARNING', details: `${approve ? 'Approved' : 'Declined'} payment ${payment.invoiceNumber} of ${payment.amount} ${payment.currency}`, before: { status: 'PENDING' }, after: { status: approval.status } },
      user,
    );

    return {
      id: approval.id, status: approval.status, decidedBy: user.id, decidedByName: decider.name, decidedAt: now,
      decisionReason: reason, paymentStatus: payment.status, walletReference: payment.walletReference ?? null,
    };
  }

  decisionState(approval: ApprovalRecord, payment: PaymentRecord, user: Pick<AuthUser, 'id' | 'permissions'>) {
    const needsSecond = this.requiresSecondApprover(payment);
    let reasonIfNot: string | null = null;
    if (approval.status !== 'PENDING') reasonIfNot = `Already ${approval.status.toLowerCase()}`;
    else if (!user.permissions.includes('payments:approve') && !user.permissions.includes('reviews:approve')) reasonIfNot = 'You do not have permission to decide this';
    else if (this.appConfig.getConfig().workflow.makerCheckerEnabled && approval.submittedBy === user.id) reasonIfNot = 'You submitted this request, so another approver must decide it';
    return {
      canDecide: reasonIfNot === null,
      reasonIfNot,
      requiresSecondApprover: needsSecond,
      secondApproverState: needsSecond ? (approval.firstApprovedBy ? 'AWAITING_SECOND' : 'AWAITING_FIRST') : null,
    };
  }

  // ───────────────────────────── internals ─────────────────────────────

  private requiresSecondApprover(payment: PaymentRecord): boolean {
    return payment.amount >= this.configs.getSettings().dualApprovalThreshold;
  }

  private appEnforcesDualControl(): boolean {
    return this.appConfig.getConfig().workflow.makerCheckerEnabled;
  }

  private paymentLabel(payment: PaymentRecord): string {
    return `${payment.kind === 'UPFRONT' ? 'Upfront' : 'Balance'} payment ${payment.invoiceNumber}`;
  }

  private requireApproval(id: number): ApprovalRecord {
    const approval = this.store.approvals.find((a) => a.id === id && a.type === 'PAYMENT');
    if (!approval) throw ClaimsException.notFound('Payment approval', id);
    return approval;
  }

  private requirePayment(id: number): PaymentRecord {
    const payment = this.store.payments.find((p) => p.id === id);
    if (!payment) throw ClaimsException.notFound('Payment', id);
    return payment;
  }

  private requireClaim(id: number): ClaimRecord {
    const claim = this.store.findClaim(id);
    if (!claim) throw ClaimsException.notFound('Claim', id);
    return claim;
  }

  toRow(payment: PaymentRecord) {
    const claim = this.requireClaim(payment.claimId);
    const vendor = this.store.vendors.find((v) => v.id === payment.vendorId);
    const quote = this.store.quotes.find((q) => q.id === claim.quoteId);
    return {
      id: payment.id,
      claimId: claim.id,
      claimReference: claim.reference,
      kind: payment.kind,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      invoiceNumber: payment.invoiceNumber,
      payeeVendorId: payment.vendorId,
      payeeVendorName: vendor?.name ?? VENDOR_NAME_FALLBACK,
      paymentSplit: payment.paymentSplit,
      approvalId: payment.approvalId ?? null,
      createdAt: payment.createdAt,
      // Fields the current Claims UI tables read.
      claimType: claim.claimType,
      country: claim.country,
      customer: claim.customer,
      car: claim.car,
      issueTypes: claim.issueTypes,
      paymentStatus: payment.status,
      vendor: vendor?.name ?? VENDOR_NAME_FALLBACK,
      requestDate: payment.createdAt,
      repairDate: payment.createdAt,
      repairAmount: payment.amount,
      quoteStatus: quote?.status === 'APPROVED' ? 'QUOTE_APPROVED' : 'QUOTE_PENDING',
    };
  }

  toApprovalRow(approval: ApprovalRecord) {
    const payment = this.requirePayment(approval.paymentId!);
    const claim = this.requireClaim(payment.claimId);
    const vendor = this.store.vendors.find((v) => v.id === payment.vendorId);
    const car = claim.car;
    const kindLabel = payment.kind === 'UPFRONT' ? 'Quote Upfront' : 'Repairs';
    return {
      id: approval.id,
      paymentId: payment.id,
      claimId: claim.id,
      claimReference: claim.reference,
      kind: payment.kind,
      status: approval.status,
      amount: payment.amount,
      currency: payment.currency,
      invoiceNumber: payment.invoiceNumber,
      paymentSplit: payment.paymentSplit,
      submittedBy: approval.submittedBy,
      submittedByName: approval.submittedByName,
      submittedAt: approval.submittedAt,
      overdue: approval.status === 'PENDING' && new Date(approval.overdueAt) < new Date(),
      // Fields the current Claims UI tables read.
      claimType: claim.claimType,
      paymentType: payment.kind === 'UPFRONT' ? 'upfront' : 'repair',
      country: claim.country,
      requestDate: approval.submittedAt,
      description: `${claim.claimType} ${kindLabel} for ${claim.customer.name}(${car.year} ${car.make} ${car.model}) to ${vendor?.name ?? VENDOR_NAME_FALLBACK}`,
      accountName: vendor?.name ?? VENDOR_NAME_FALLBACK,
      customer: claim.customer,
    };
  }
}
