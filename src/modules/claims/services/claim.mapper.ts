import { toFileView } from '../../../common/utils/file-ref.util';
import { statusLabel } from '../../../domain/claim.constants';
import { warrantyCap } from '../../../domain/cover';
import { ClaimRecord, QuoteRecord, TimelineRecord } from '../../../domain/claim.types';

/** Row shape for `GET /v1/claims` (API spec 1.1, plus the fields the UI table reads). */
export const toClaimListItem = (claim: ClaimRecord) => ({
  id: claim.id,
  reference: claim.reference,
  jobOrderNumber: claim.jobOrderNumber,
  claimType: claim.claimType,
  warrantyType: claim.warrantyType ?? null,
  status: claim.status,
  statusLabel: statusLabel(claim.status),
  country: claim.country,
  currency: claim.currency,
  requestDate: claim.requestDate,
  claimsDate: claim.claimsDate,
  appointmentDate: claim.appointmentDate ?? null,
  customer: claim.customer,
  car: claim.car,
  vendor: claim.vendor ? { id: claim.vendor.id, name: claim.vendor.name, country: claim.vendor.country } : null,
  issueSubType: claim.issueSubType,
  issueTypes: claim.issueTypes,
  odometer: claim.odometer,
  ppiHighlighted: claim.ppiHighlighted,
  insuranceClaim: claim.insuranceClaim,
  trackerStatus: claim.trackerStatus,
  repairFinanced: claim.repairFinanced,
  upfrontAmount: claim.upfrontAmount ?? null,
  totalAmount: claim.totalAmount ?? null,
  warrantyCapUsedAmount: claim.warrantyCapUsedAmount,
  qa: toQaView(claim),
  version: claim.version,
  createdAt: claim.createdAt,
  updatedAt: claim.updatedAt,
  lastUpdated: claim.updatedAt,
  updatedBy: claim.updatedBy,
});

export const toQaView = (claim: ClaimRecord) =>
  claim.qa
    ? {
        ...claim.qa,
        overdue: claim.qa.state !== 'PASSED' && claim.qa.state !== 'CANCELLED' && new Date(claim.qa.slaDueAt) < new Date(),
      }
    : null;

export const toQuoteSummary = (quote: QuoteRecord) => ({
  id: quote.id,
  revision: quote.revision,
  kind: quote.kind,
  status: quote.status,
  invoiceNumber: quote.invoiceNumber,
  upfrontAmount: quote.upfrontAmount,
  totalAmount: quote.totalAmount,
  currency: quote.currency,
  lineItemCount: quote.lineItems.length,
});

export const toTimelineView = (entry: TimelineRecord) => ({
  id: entry.id,
  event: entry.event,
  channel: entry.channel,
  message: entry.message,
  timestamp: entry.timestamp,
  actor: entry.actor ?? null,
});

export const buildWarrantyCap = (claim: ClaimRecord, capPercentage: number) =>
  warrantyCap(claim.car.price, claim.warrantyCapUsedAmount, capPercentage);

export const toProofView = (proof: ClaimRecord['repairCompletionProof'] | undefined) =>
  proof ? { ...toFileView(proof.file), submittedAt: proof.submittedAt, notes: proof.notes ?? null } : null;
