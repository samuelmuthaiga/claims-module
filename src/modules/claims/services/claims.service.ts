import { HttpStatus, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { AuthUser } from '../../../auth/interfaces/auth-user.interface';
import { Paginated } from '../../../common/dto/pagination-response.dto';
import { ClaimsException, ErrorCode } from '../../../common/exceptions/claims.exception';
import { FieldError } from '../../../common/interfaces/error-response.interface';
import { resolveFileRef, toFileView } from '../../../common/utils/file-ref.util';
import { paginate } from '../../../common/utils/paginate.util';
import { compareBy, includesText, parseSort } from '../../../common/utils/query.util';
import { AppConfigService } from '../../../config/app-config.service';
import { round2, statusLabel } from '../../../domain/claim.constants';
import { coverBreakdown } from '../../../domain/cover';
import { carEligibility } from '../../../domain/eligibility';
import {
  ApprovalRecord, ClaimRecord, ClaimStatus, FileRef, QuoteLineItem, QuoteRecord,
} from '../../../domain/claim.types';
import { MockDataStore } from '../../../store/mock-data.store';
import { ConfigContextService } from '../../configs/services/config-context.service';
import { ConfigsService } from '../../configs/services/configs.service';
import { ClaimWorkflowService } from '../../claim-workflow/services/claim-workflow.service';
import { AuditService } from '../../audit-logs/services/audit.service';
import { CreateClaimDto } from '../dto/create-claim.dto';
import {
  CancelClaimDto, PaymentSplitDto, PickupDto, RepairCompletionDto, RequestDiagnosisApprovalDto,
  TimelineQueryDto, UploadQuoteDto,
} from '../dto/claim-actions.dto';
import { CLAIM_SORT_FIELDS, ListClaimsQueryDto } from '../dto/list-claims-query.dto';
import {
  buildWarrantyCap, toClaimListItem, toProofView, toQaView, toQuoteSummary, toTimelineView,
} from './claim.mapper';

const HOUR = 3_600_000;

@Injectable()
export class ClaimsService {
  constructor(
    private readonly store: MockDataStore,
    private readonly workflow: ClaimWorkflowService,
    private readonly configs: ConfigsService,
    private readonly contexts: ConfigContextService,
    private readonly appConfig: AppConfigService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── queries ─────────────────────────────

  list(query: ListClaimsQueryDto): Paginated<ReturnType<typeof toClaimListItem>> {
    const from = query.from ? new Date(query.from).getTime() : undefined;
    const to = query.to ? new Date(query.to).getTime() + 86_399_999 : undefined;
    const sort = parseSort(query.sort, CLAIM_SORT_FIELDS, { field: 'created_at', direction: 'desc' });

    const rows = this.store.claims
      .filter((claim) => {
        if (query.country && claim.country !== query.country) return false;
        if (query.status?.length && !query.status.includes(claim.status)) return false;
        if (query.claimType && claim.claimType !== query.claimType) return false;
        if (query.vendorId && claim.vendor?.id !== query.vendorId) return false;
        if (query.qaState && claim.qa?.state !== query.qaState) return false;
        const requested = new Date(claim.requestDate).getTime();
        if (from !== undefined && requested < from) return false;
        if (to !== undefined && requested > to) return false;
        return this.matchesSearch(claim, query.searchType, query.search);
      })
      .sort(
        compareBy<ClaimRecord>(sort, (claim, field) =>
          field === 'status' ? claim.status : field === 'id' ? claim.id : field === 'request_date' ? claim.requestDate : claim.createdAt,
        ),
      );

    const page = paginate(rows, query.page, query.limit);
    return { data: page.data.map(toClaimListItem), meta: page.meta };
  }

  private matchesSearch(claim: ClaimRecord, searchType: string | undefined, search: string | undefined): boolean {
    if (!search) return true;
    const fields: Record<string, unknown> = {
      CLAIM_ID: claim.id,
      CUSTOMER_NAME: claim.customer.name,
      CUSTOMER_EMAIL: claim.customer.email,
      VIN: claim.car.vin,
      PLATE_NUMBER: claim.car.plateNumber,
      CAR_ID: claim.car.id,
      LOAN_ID: claim.car.loanId,
    };
    if (searchType) return includesText(fields[searchType], search);
    return Object.values(fields).some((value) => includesText(value, search));
  }

  summary() {
    const active = this.store.claims.filter((c) => !this.workflow.isTerminal(c.status));
    const count = (type: string) => active.filter((c) => c.claimType === type).length;
    return {
      vehiclesInWorkshop: active.length,
      repair: count('REPAIRS'),
      warranty: count('WARRANTY'),
      insurance: count('INSURANCE'),
    };
  }

  get(id: number, user: AuthUser) {
    const claim = this.require(id);
    const quote = claim.quoteId ? this.store.quotes.find((q) => q.id === claim.quoteId) : undefined;
    const settings = this.configs.getSettings();

    return {
      ...toClaimListItem(claim),
      legacyStatus: null,
      customerNotes: claim.customerNotes ?? null,
      initialDetails: claim.initialDetails ?? null,
      requestChannel: claim.requestChannel ?? null,
      supportingDocument: toFileView(claim.supportingDocument),
      diagnosisReport: toFileView(claim.diagnosisReport),
      scanReport: toFileView(claim.scanReport),
      diagnosisNotes: claim.diagnosisNotes ?? null,
      paymentSplit: claim.paymentSplit,
      quote: quote ? toQuoteSummary(quote) : null,
      repairCompletionProof: toProofView(claim.repairCompletionProof),
      pickupProof: claim.pickupProof
        ? { ...toFileView(claim.pickupProof.file), submittedAt: claim.pickupProof.submittedAt }
        : null,
      warrantyCap: buildWarrantyCap(claim, settings.warrantyCapPercentage),
      intelligence: { ...claim.intelligence, asOf: claim.updatedAt, unavailable: false },
      scheduling: claim.scheduling ?? null,
      cancellation: claim.cancelledAt
        ? { cancelledAt: claim.cancelledAt, cancelledBy: claim.cancelledBy, cancelledReason: claim.cancelledReason }
        : null,
      workflow: { configId: 1, version: 1, rail: this.workflow.buildRail(claim) },
      reviewTarget: this.workflow.reviewTarget(claim),
      qa: toQaView(claim),
      availableActions: this.workflow.availableActions(claim, user),
      // Shape the current detail page reads for its activity feed.
      activityLog: this.store.timeline
        .filter((t) => t.claimId === claim.id)
        .map(toTimelineView),
      createdBy: claim.createdBy,
    };
  }

  timeline(id: number, query: TimelineQueryDto) {
    this.require(id);
    const rows = this.store.timeline.filter((t) => t.claimId === id).sort((a, b) => a.id - b.id);
    const page = paginate(rows, query.page, query.limit);
    return { data: page.data.map(toTimelineView), meta: page.meta };
  }

  statusHistory(id: number) {
    this.require(id);
    return this.store.history
      .filter((h) => h.claimId === id)
      .sort((a, b) => a.id - b.id)
      .map(({ claimId: _claimId, ...entry }) => entry);
  }

  documents(id: number) {
    this.require(id);
    return this.store.documents
      .filter((d) => d.claimId === id)
      .map((d) => ({
        id: d.id, documentType: d.documentType, fileId: d.fileId, fileName: d.fileName,
        readUrl: d.url, uploadedAt: d.uploadedAt, uploadedBy: d.uploadedBy,
      }));
  }

  availableActions(id: number, user: AuthUser) {
    return this.workflow.availableActions(this.require(id), user);
  }

  coverBreakdown(id: number) {
    return coverBreakdown(this.store, this.require(id).car.id);
  }

  // ───────────────────────────── create ─────────────────────────────

  create(dto: CreateClaimDto, user: AuthUser) {
    const car = this.store.cars.find((c) => c.id === dto.carId);
    if (!car) throw ClaimsException.notFound('Car', dto.carId);
    const customer = this.store.customers.find((c) => c.id === car.customerId);
    if (!customer) throw ClaimsException.notFound('Customer', car.customerId);

    const eligibility = carEligibility(this.store, this.configs.getSettings(), car.id)[dto.claimType.toLowerCase() as 'warranty' | 'repairs' | 'insurance'];
    if (!eligibility.eligible) {
      throw ClaimsException.unprocessable(ErrorCode.CAR_NOT_ELIGIBLE, eligibility.reason ?? 'Car is not eligible for this claim type');
    }

    const open = this.store.claims.find(
      (c) => c.car.id === car.id && c.claimType === dto.claimType && !this.workflow.isTerminal(c.status),
    );
    if (open) {
      throw ClaimsException.conflict(
        ErrorCode.DUPLICATE_OPEN_CLAIM,
        `This car already has an open ${dto.claimType.toLowerCase()} claim (${open.reference})`,
      );
    }

    const supporting = resolveFileRef(dto.supportingDocumentUrl, dto.supportingFileId, 'supporting-document');
    const settings = this.configs.getSettings();
    const now = new Date();
    const country = this.store.countries.find((c) => c.currency === car.currency)?.code ?? 'NG';
    const id = this.store.nextId('claim');
    const serial = String(id).padStart(6, '0');
    const token = randomBytes(18).toString('base64url');
    const expiresAt = new Date(now.getTime() + settings.scheduleLink.ttlHours * HOUR).toISOString();

    const claim: ClaimRecord = {
      id,
      reference: `CLM-${country}-${now.getFullYear()}-${serial}`,
      jobOrderNumber: `JO-${country}-${now.getFullYear()}-${serial}`,
      claimType: dto.claimType,
      warrantyType: dto.claimType === 'WARRANTY' ? dto.warrantyType : undefined,
      status: ClaimStatus.JOB_ORDER_CREATED,
      country,
      currency: car.currency,
      requestDate: now.toISOString(),
      claimsDate: now.toISOString(),
      customer: { ...customer, phone: dto.customerPhone },
      car,
      issueSubType: 'Awaiting Customer Form',
      issueTypes: [],
      odometer: 0,
      ppiHighlighted: false,
      insuranceClaim: dto.claimType === 'INSURANCE',
      trackerStatus: 'Unknown',
      repairFinanced: false,
      initialDetails: dto.initialDetails,
      requestChannel: dto.requestChannel,
      supportingDocument: supporting,
      paymentSplit: { customer: 0, autochek: 0, insurance: 0, repairFinancing: 0 },
      warrantyCapUsedAmount: 0,
      intelligence: { amcDone: 0, expectedAmc: 4, coverStartDate: null, operationalStatus: null, ifrsStatus: null },
      scheduleToken: token,
      scheduleTokenExpiresAt: expiresAt,
      scheduleResends: [],
      needsTypeConfirmation: false,
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      createdBy: user.id,
      updatedBy: user.id,
    };
    this.store.claims.unshift(claim);

    this.store.history.push({
      id: this.store.nextId('history'), claimId: id, fromStatus: null, toStatus: ClaimStatus.JOB_ORDER_CREATED,
      action: 'create_claim', actorId: user.id, actorRole: user.roles[0] ?? 'USER', reason: null, occurredAt: now.toISOString(),
    });
    this.workflow.log(claim, 'Job order created', `Logged via ${dto.requestChannel.toLowerCase().replace('_', ' ')}. ${dto.initialDetails}`, user);
    this.workflow.log(claim, 'Scheduling form sent', `Scheduling link sent to ${customer.email} to confirm repair type, workshop and appointment.`, user, 'Email');
    this.addDocument(claim, 'JOB_ORDER', { fileId: `file-jo-${id}`, name: `job_order_${id}.pdf`, url: `https://files.claims.autochek.africa/mock/job_order_${id}.pdf` }, user.id);
    if (supporting) this.addDocument(claim, 'SUPPORTING_DOCUMENT', supporting, user.id);

    this.audit.record(
      { module: 'CLAIMS', action: 'CLAIM_CREATED', entityType: 'claim', entityId: id, claimId: id, details: `Created ${claim.reference} (${claim.claimType})`, after: { status: claim.status } },
      user,
    );

    return {
      id,
      reference: claim.reference,
      jobOrderNumber: claim.jobOrderNumber,
      claimType: claim.claimType,
      warrantyType: claim.warrantyType ?? null,
      status: claim.status,
      country,
      currency: claim.currency,
      scheduleLink: this.scheduleLink(token),
      scheduleLinkExpiresAt: expiresAt,
    };
  }

  // ───────────────────────────── actions ─────────────────────────────

  resendScheduleLink(id: number, user: AuthUser, ifMatch?: number) {
    const claim = this.require(id);
    this.workflow.assertVersion(claim, ifMatch);
    this.workflow.assertStatus(claim, [ClaimStatus.JOB_ORDER_CREATED], 'resend the scheduling link');

    const { resendCap, resendWindowHours, ttlHours } = this.configs.getSettings().scheduleLink;
    const windowStart = Date.now() - resendWindowHours * HOUR;
    const recent = claim.scheduleResends.filter((at) => new Date(at).getTime() > windowStart);
    if (recent.length >= resendCap) {
      throw new ClaimsException(
        HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED,
        `The scheduling link can be resent ${resendCap} times every ${resendWindowHours} hours`,
      );
    }

    claim.scheduleToken = randomBytes(18).toString('base64url');
    claim.scheduleTokenExpiresAt = new Date(Date.now() + ttlHours * HOUR).toISOString();
    claim.scheduleResends = [...recent, new Date().toISOString()];
    this.workflow.log(claim, 'Scheduling form resent', `Scheduling link resent to ${claim.customer.email}.`, user, 'Email');
    this.workflow.touch(claim, user);

    return {
      success: true,
      message: 'Scheduling link sent to customer email and phone',
      scheduleLink: this.scheduleLink(claim.scheduleToken),
      scheduleLinkExpiresAt: claim.scheduleTokenExpiresAt,
    };
  }

  requestDiagnosisApproval(id: number, dto: RequestDiagnosisApprovalDto, user: AuthUser, ifMatch?: number) {
    const claim = this.require(id);
    this.workflow.assertVersion(claim, ifMatch);
    this.workflow.assertStatus(claim, [ClaimStatus.CUSTOMER_SUBMITTED_FORM], 'request diagnosis approval');

    const proof = resolveFileRef(dto.workshopProofUrl, dto.workshopProofFileId, 'workshop-proof');
    this.validatePayload('diagnosis-approval-request', { workshopProofUrl: proof?.url }, claim, [
      proof ? undefined : { key: 'workshopProofUrl', message: 'Please upload proof that the car is at the workshop' },
    ]);

    const approval = this.workflow.raiseApproval(claim, 'DIAGNOSIS', claim.id, `Diagnosis for ${claim.reference}`, user, { workshopProof: proof });
    this.addDocument(claim, 'WORKSHOP_PROOF', proof!, user.id);
    this.workflow.transition(claim, ClaimStatus.PENDING_APPROVAL, {
      action: 'request_diagnosis_approval', actor: user, event: 'Diagnosis approval requested',
      message: 'Approval to carry out diagnosis requested from claims admin.',
    });

    return { approvalId: approval.id, status: approval.status, submittedAt: approval.submittedAt };
  }

  uploadQuote(id: number, dto: UploadQuoteDto, user: AuthUser, ifMatch?: number) {
    const claim = this.require(id);
    this.workflow.assertVersion(claim, ifMatch);
    this.workflow.assertStatus(claim, [ClaimStatus.DIAGNOSIS_IN_PROGRESS], 'upload a quote');

    const diagnosisReport = resolveFileRef(dto.diagnosisReportUrl, dto.diagnosisReportFileId, 'diagnosis-report');
    const scanReport = resolveFileRef(dto.scanReportUrl, dto.scanReportFileId, 'scan-report');
    const invoice = resolveFileRef(dto.documentUrl, dto.invoiceFileId, 'invoice');

    // Lines are priced here, never trusted: amount = quantity × unitAmount.
    const lineErrors: FieldError[] = [];
    const lineItems: QuoteLineItem[] = dto.lineItems.map((line, index) => {
      const amount = round2(line.quantity * line.unitAmount);
      if (line.amount !== undefined && Math.abs(line.amount - amount) >= 0.01) {
        lineErrors.push({ key: `lineItems.${index}.amount`, message: `amount must equal quantity × unitAmount (${amount})` });
      }
      return {
        lineNo: line.lineNo ?? index + 1, description: line.description, spec: line.spec, brand: line.brand,
        condition: line.condition, quantity: line.quantity, unitAmount: line.unitAmount, amount,
        categoryCode: line.categoryCode,
      };
    });

    this.validatePayload(
      'quote-upload',
      {
        diagnosisReportUrl: diagnosisReport?.url, scanReportUrl: scanReport?.url, documentUrl: invoice?.url,
        issueTypes: dto.issueTypes, diagnosisNotes: dto.diagnosisNotes, invoiceNumber: dto.invoiceNumber,
        upfrontAmount: dto.upfrontAmount, totalAmount: dto.totalAmount, lineItems,
      },
      claim,
      lineErrors,
    );

    const linesTotal = round2(lineItems.reduce((sum, line) => sum + line.amount, 0));
    if (dto.upfrontAmount > dto.totalAmount) {
      throw ClaimsException.unprocessable(ErrorCode.QUOTE_UPFRONT_EXCEEDS_TOTAL, 'Upfront amount cannot exceed the total amount');
    }
    if (Math.abs(linesTotal - dto.totalAmount) >= 0.01) {
      throw ClaimsException.unprocessable(ErrorCode.QUOTE_TOTAL_MISMATCH, `Line items add up to ${linesTotal} but the total is ${dto.totalAmount}`, { linesTotal, totalAmount: dto.totalAmount });
    }

    const vendorId = claim.vendor?.id ?? 'unassigned';
    const duplicate = this.store.quotes.find(
      (q) => q.vendorId === vendorId && q.invoiceNumber.toLowerCase() === dto.invoiceNumber.toLowerCase() && q.status !== 'DECLINED',
    );
    if (duplicate) {
      throw ClaimsException.conflict(ErrorCode.DUPLICATE_INVOICE, `Invoice ${dto.invoiceNumber} has already been submitted for this workshop`);
    }

    if (claim.claimType === 'WARRANTY') {
      const cap = buildWarrantyCap(claim, this.configs.getSettings().warrantyCapPercentage);
      if (dto.totalAmount > cap.remaining) {
        throw ClaimsException.unprocessable(ErrorCode.WARRANTY_CAP_EXCEEDED, `Quote of ${dto.totalAmount} exceeds the remaining warranty cap of ${cap.remaining}`, cap);
      }
    }

    const previous = this.store.quotes.filter((q) => q.claimId === claim.id);
    const quote: QuoteRecord = {
      id: this.store.nextId('quote'), claimId: claim.id, revision: previous.length + 1,
      kind: previous.length ? 'REVISION' : 'INITIAL', status: 'SUBMITTED', invoiceNumber: dto.invoiceNumber,
      upfrontAmount: dto.upfrontAmount, totalAmount: dto.totalAmount, currency: claim.currency, lineItems,
      diagnosisReport: diagnosisReport!, scanReport: scanReport!, invoice: invoice!, issueTypes: dto.issueTypes,
      diagnosisNotes: dto.diagnosisNotes, vendorId, submittedAt: new Date().toISOString(), submittedBy: user.id,
    };
    this.store.quotes.push(quote);

    Object.assign(claim, {
      quoteId: quote.id, diagnosisReport, scanReport, diagnosisNotes: dto.diagnosisNotes,
      issueTypes: dto.issueTypes, upfrontAmount: dto.upfrontAmount, totalAmount: dto.totalAmount,
      paymentSplit: { customer: 0, autochek: 0, insurance: 0, repairFinancing: 0 },
    });
    this.addDocument(claim, 'DIAGNOSIS_REPORT', diagnosisReport!, user.id);
    this.addDocument(claim, 'SCAN_REPORT', scanReport!, user.id);
    this.addDocument(claim, 'INVOICE', invoice!, user.id);

    let approvalId: number | null = null;
    if (this.workflow.requiresPaymentSplit(claim)) {
      this.workflow.transition(claim, ClaimStatus.QUOTE_SUBMITTED, {
        action: 'upload_quote', actor: user, event: 'Repair quote uploaded',
        message: `Invoice ${dto.invoiceNumber} uploaded. Awaiting payment split before review.`,
      });
    } else {
      approvalId = this.sendQuoteForReview(claim, quote, user, `Invoice ${dto.invoiceNumber} uploaded for claims admin review.`, 'upload_quote');
    }

    return {
      quoteId: quote.id, revision: quote.revision, kind: quote.kind, status: quote.status,
      invoiceNumber: quote.invoiceNumber, upfrontAmount: quote.upfrontAmount, totalAmount: quote.totalAmount,
      currency: quote.currency, approvalId,
    };
  }

  submitPaymentSplit(id: number, dto: PaymentSplitDto, user: AuthUser, ifMatch?: number) {
    const claim = this.require(id);
    this.workflow.assertVersion(claim, ifMatch);
    this.workflow.assertStatus(claim, [ClaimStatus.QUOTE_SUBMITTED], 'submit the payment split');

    const split = {
      customer: dto.customer, autochek: dto.autochek, insurance: dto.insurance, repairFinancing: dto.repairFinancing ?? 0,
    };
    const extra: (FieldError | undefined)[] = [
      split.repairFinancing > 0 && !claim.repairFinanced
        ? { key: 'repairFinancing', message: 'Repair financing is only allowed on repair-financed claims' }
        : undefined,
    ];
    this.validatePayload('payment-split', split, claim, extra);

    const quote = this.store.quotes.find((q) => q.id === claim.quoteId)!;
    claim.paymentSplit = split;
    this.sendQuoteForReview(claim, quote, user, 'Payment split agreed — quote sent for claims admin review.', 'submit_payment_split');

    return { ...split, total: round2(split.customer + split.autochek + split.insurance + split.repairFinancing) };
  }

  completeRepair(id: number, dto: RepairCompletionDto, user: AuthUser, ifMatch?: number) {
    const claim = this.require(id);
    this.workflow.assertVersion(claim, ifMatch);
    this.workflow.assertStatus(claim, [ClaimStatus.REPAIR_ONGOING], 'complete the repair');

    const proof = resolveFileRef(dto.afterImageUrl, dto.afterImageFileId, 'repair-completion');
    this.validatePayload('repair-completion', { afterImageUrl: proof?.url, notes: dto.notes }, claim, []);

    const submittedAt = new Date().toISOString();
    claim.repairCompletionProof = { file: proof!, submittedAt, notes: dto.notes };
    this.addDocument(claim, 'REPAIR_COMPLETION', proof!, user.id);

    // A failed QC round sends the claim back here; the next inspection is a new round.
    const round = claim.qa && claim.qa.state === 'CORRECTIVE_ACTION_REQUIRED' ? claim.qa.round + 1 : 1;
    claim.qa = {
      inspectionId: claim.qa?.inspectionId ?? this.store.nextId('inspection'), state: 'ASSIGNED', round,
      failedItemCount: 0, assignedInspector: 'inspector-123',
      slaDueAt: new Date(Date.now() + 72 * HOUR).toISOString(),
    };

    this.workflow.raiseApproval(claim, 'QA_SIGNOFF', claim.qa.inspectionId, `QC for ${claim.reference}`, user);
    this.workflow.transition(claim, ClaimStatus.QUALITY_CONTROL, {
      action: 'complete_repair', actor: user, event: 'Repair marked complete',
      message: 'Workshop submitted proof of repair completion. Awaiting quality control.',
    });

    const { inspectionId, state, assignedInspector, slaDueAt } = claim.qa;
    return { status: claim.status, qa: { inspectionId, state, assignedInspector, slaDueAt } };
  }

  completePickup(id: number, dto: PickupDto, user: AuthUser, ifMatch?: number) {
    const claim = this.require(id);
    this.workflow.assertVersion(claim, ifMatch);
    this.workflow.assertStatus(claim, [ClaimStatus.VEHICLE_READY], 'complete the pickup');
    if (claim.qa && claim.qa.state !== 'PASSED') {
      throw ClaimsException.conflict(ErrorCode.READY_BLOCKED_BY_QA, 'The vehicle cannot be handed over until quality control has passed');
    }

    const file = resolveFileRef(dto.pickupFileUrl, dto.pickupFileId, 'pickup-proof');
    const submittedAt = dto.pickupDate ?? new Date().toISOString();
    claim.pickupProof = { file, submittedAt };
    if (file) this.addDocument(claim, 'PICKUP_PROOF', file, user.id);

    this.workflow.transition(claim, ClaimStatus.VEHICLE_DELIVERED, {
      action: 'complete_pickup', actor: user, event: 'Vehicle picked up', message: 'Customer picked up the vehicle.',
    });
    return { status: claim.status, pickupProof: claim.pickupProof.file ? { ...toFileView(file), submittedAt } : { submittedAt } };
  }

  cancel(id: number, dto: CancelClaimDto, user: AuthUser, ifMatch?: number) {
    const claim = this.require(id);
    this.workflow.assertVersion(claim, ifMatch);
    if (this.workflow.isTerminal(claim.status)) {
      throw ClaimsException.invalidTransition(`Cannot cancel a claim that is ${statusLabel(claim.status)}`);
    }

    const now = new Date().toISOString();
    claim.cancelledAt = now;
    claim.cancelledBy = user.id;
    claim.cancelledReason = dto.reason;
    if (claim.qa && claim.qa.state !== 'PASSED') claim.qa.state = 'CANCELLED';

    // Anything still waiting on a decision is closed with the claim.
    this.store.approvals
      .filter((a) => a.claimId === claim.id && a.status === 'PENDING')
      .forEach((a) => {
        a.status = 'DECLINED';
        a.decidedBy = 'system';
        a.decidedByName = 'System';
        a.decidedAt = now;
        a.decisionReason = 'Claim cancelled';
        a.version += 1;
      });

    this.workflow.transition(claim, ClaimStatus.CANCELLED, {
      action: 'cancel_claim', actor: user, event: 'Claim cancelled', message: dto.reason, reason: dto.reason,
    });
    return { status: claim.status, cancelledAt: now, cancelledBy: user.id, cancelledReason: dto.reason };
  }

  // ───────────────────────────── internals ─────────────────────────────

  private require(id: number): ClaimRecord {
    const claim = this.store.findClaim(id);
    if (!claim) throw ClaimsException.notFound('Claim', id);
    return claim;
  }

  private scheduleLink(token: string): string {
    return `${this.appConfig.getConfig().app.uiBaseUrl}/schedule/${token}`;
  }

  /**
   * Runs the action payload through its form config (the single source of
   * field rules, shared with the UI) and merges any domain-level field errors.
   */
  private validatePayload(
    formKey: string,
    payload: Record<string, unknown>,
    claim: ClaimRecord,
    extraErrors: (FieldError | undefined)[],
  ): void {
    const errors = extraErrors.filter((e): e is FieldError => Boolean(e));
    try {
      this.configs.assertValid(formKey, payload, this.contexts.claimContext(claim));
    } catch (error) {
      const raised = (error as ClaimsException).getResponse() as { errors?: FieldError[] };
      const seen = new Set(errors.map((e) => e.key));
      for (const e of raised.errors ?? []) if (!seen.has(e.key)) errors.push(e);
    }
    if (errors.length) throw ClaimsException.validation(errors);
  }

  private sendQuoteForReview(claim: ClaimRecord, quote: QuoteRecord, user: AuthUser, message: string, action: string): number {
    const approval = this.workflow.raiseApproval(claim, 'QUOTE', quote.id, `Quote ${quote.invoiceNumber}`, user, {
      amount: quote.totalAmount, currency: quote.currency,
    });
    this.workflow.transition(
      claim,
      claim.claimType === 'INSURANCE' ? ClaimStatus.QUOTATION_REVIEW_WITH_INSURANCE : ClaimStatus.QUOTE_IN_REVIEW,
      { action, actor: user, event: action === 'upload_quote' ? 'Repair quote uploaded' : 'Payment split submitted', message },
    );
    return approval.id;
  }

  private addDocument(claim: ClaimRecord, documentType: string, file: FileRef, uploadedBy: string): void {
    this.store.documents.push({
      id: this.store.nextId('document'), claimId: claim.id, documentType,
      fileId: file.fileId ?? `file-${this.store.documents.length + 1}`, fileName: file.name, url: file.url,
      uploadedAt: new Date().toISOString(), uploadedBy,
    });
  }
}
