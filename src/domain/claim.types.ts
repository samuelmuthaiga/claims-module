export const CLAIM_TYPES = ['WARRANTY', 'REPAIRS', 'INSURANCE'] as const;
export type ClaimType = (typeof CLAIM_TYPES)[number];

export const WARRANTY_TYPES = ['LOAN_WARRANTY', 'CASH_WARRANTY'] as const;
export type WarrantyType = (typeof WARRANTY_TYPES)[number];

export const REQUEST_CHANNELS = ['PHONE_CALL', 'EMAIL'] as const;
export type RequestChannel = (typeof REQUEST_CHANNELS)[number];

export const ClaimStatus = {
  JOB_ORDER_CREATED: 'JOB_ORDER_CREATED',
  CUSTOMER_SUBMITTED_FORM: 'CUSTOMER_SUBMITTED_FORM',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  DIAGNOSIS_IN_PROGRESS: 'DIAGNOSIS_IN_PROGRESS',
  QUOTE_SUBMITTED: 'QUOTE_SUBMITTED',
  QUOTE_IN_REVIEW: 'QUOTE_IN_REVIEW',
  QUOTATION_REVIEW_WITH_INSURANCE: 'QUOTATION_REVIEW_WITH_INSURANCE',
  DISCHARGE_VOUCHER_SHARED: 'DISCHARGE_VOUCHER_SHARED',
  REPAIR_ONGOING: 'REPAIR_ONGOING',
  QUALITY_CONTROL: 'QUALITY_CONTROL',
  REPAIR_COMPLETED: 'REPAIR_COMPLETED',
  BALANCE_PAYMENT: 'BALANCE_PAYMENT',
  VEHICLE_READY: 'VEHICLE_READY',
  VEHICLE_DELIVERED: 'VEHICLE_DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type ClaimStatusCode = (typeof ClaimStatus)[keyof typeof ClaimStatus];

export const TERMINAL_STATUSES: ClaimStatusCode[] = [
  ClaimStatus.VEHICLE_DELIVERED,
  ClaimStatus.CANCELLED,
];

export const APPROVAL_TYPES = ['DIAGNOSIS', 'QUOTE', 'QA_SIGNOFF', 'PAYMENT'] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'DECLINED';

export const PAYMENT_STATUSES = [
  'PENDING',
  'PENDING_APPROVAL',
  'DISPUTED',
  'APPROVED',
  'INVOICE_DECLINED',
  'PAID',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentKind = 'UPFRONT' | 'BALANCE';

export interface CustomerRef {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export interface CarRef {
  id: string;
  loanId: string;
  acquireId: string;
  warrantyId: string;
  vin: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  price: number;
  currency: string;
  customerId: string;
}

export interface VendorRef {
  id: string;
  name: string;
  country: string;
  city?: string;
  category?: string;
  active?: boolean;
}

export interface FileRef {
  fileId?: string;
  name: string;
  url: string;
}

export interface PaymentSplit {
  customer: number;
  autochek: number;
  insurance: number;
  repairFinancing: number;
}

export interface QuoteLineItem {
  lineNo: number;
  description: string;
  spec?: string;
  brand?: string;
  condition?: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  categoryCode?: string;
  /** Plan component this line is claimed against (cover breakdown item name). */
  coverItem?: string;
}

export interface QuoteRecord {
  id: number;
  claimId: number;
  revision: number;
  kind: 'INITIAL' | 'REVISION';
  status: 'SUBMITTED' | 'APPROVED' | 'DECLINED';
  invoiceNumber: string;
  upfrontAmount: number;
  totalAmount: number;
  currency: string;
  lineItems: QuoteLineItem[];
  diagnosisReport: FileRef;
  scanReport: FileRef;
  invoice: FileRef;
  issueTypes: string[];
  diagnosisNotes?: string;
  vendorId: string;
  submittedAt: string;
  submittedBy: string;
}

export type QaInspectionState =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'CORRECTIVE_ACTION_REQUIRED'
  | 'PASSED'
  | 'CANCELLED';

export interface QaRecord {
  inspectionId: number;
  state: QaInspectionState;
  round: number;
  failedItemCount: number;
  assignedInspector: string;
  slaDueAt: string;
}

export interface SchedulingSubmission {
  repairType: string;
  repairCategory: string;
  preferredWorkshop: string;
  appointmentDate: string;
  customerNotes?: string;
  submittedAt: string;
  confirmationRef: string;
}

export interface ClaimRecord {
  id: number;
  reference: string;
  jobOrderNumber: string;
  claimType: ClaimType;
  warrantyType?: WarrantyType;
  status: ClaimStatusCode;
  country: string;
  currency: string;
  requestDate: string;
  claimsDate: string;
  appointmentDate?: string;
  customer: CustomerRef;
  car: CarRef;
  vendor?: VendorRef;
  issueSubType: string;
  issueTypes: string[];
  odometer: number;
  ppiHighlighted: boolean;
  insuranceClaim: boolean;
  trackerStatus: 'Active' | 'Inactive' | 'Unknown';
  repairFinanced: boolean;
  customerNotes?: string;
  initialDetails?: string;
  requestChannel?: RequestChannel;
  supportingDocument?: FileRef;
  diagnosisReport?: FileRef;
  scanReport?: FileRef;
  diagnosisNotes?: string;
  upfrontAmount?: number;
  totalAmount?: number;
  paymentSplit: PaymentSplit;
  warrantyCapUsedAmount: number;
  quoteId?: number;
  repairCompletionProof?: { file: FileRef; submittedAt: string; notes?: string };
  pickupProof?: { file?: FileRef; submittedAt: string };
  qa?: QaRecord;
  intelligence: {
    amcDone: number;
    expectedAmc: number;
    coverStartDate: string | null;
    operationalStatus: string | null;
    ifrsStatus: string | null;
  };
  scheduling?: SchedulingSubmission;
  scheduleToken: string;
  scheduleTokenExpiresAt: string;
  scheduleTokenUsedAt?: string;
  scheduleResends: string[];
  needsTypeConfirmation: boolean;
  cancelledAt?: string;
  cancelledBy?: string;
  cancelledReason?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface StatusHistoryRecord {
  id: number;
  claimId: number;
  fromStatus: ClaimStatusCode | null;
  toStatus: ClaimStatusCode;
  action: string;
  actorId: string;
  actorRole: string;
  reason: string | null;
  occurredAt: string;
}

export interface TimelineRecord {
  id: number;
  claimId: number;
  event: string;
  channel: 'Email' | 'WhatsApp' | 'System' | 'Public';
  message: string;
  timestamp: string;
  actor?: { id: string; name: string; role: string };
}

export interface ClaimDocumentRecord {
  id: number;
  claimId: number;
  documentType: string;
  fileId: string;
  fileName: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ApprovalRecord {
  id: number;
  type: ApprovalType;
  status: ApprovalStatus;
  claimId: number;
  subjectId: number;
  subjectLabel: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: string;
  overdueAt: string;
  amount?: number;
  currency?: string;
  workshopProof?: FileRef;
  paymentId?: number;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionReason?: string;
  /** First sign-off on payments at or above the dual-approval threshold. */
  firstApprovedBy?: string;
  version: number;
}

export interface PaymentRecord {
  id: number;
  claimId: number;
  kind: PaymentKind;
  status: PaymentStatus;
  amount: number;
  currency: string;
  invoiceNumber: string;
  vendorId: string;
  paymentSplit: PaymentSplit;
  approvalId?: number;
  requestedBy?: string;
  walletReference?: string;
  statusReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartPriceRecord {
  id: number;
  partName: string;
  workshop: string;
  vendorId: string;
  approvedPrice: number;
  currency: string;
  country: string;
  carLabel: string;
  make: string;
  model: string;
  category?: string;
  oemNumber?: string;
  approvedDate: string;
  claimId: number;
}

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditLogRecord {
  id: string;
  seq: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  actorIp: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  claimId?: number;
  severity: AuditSeverity;
  details: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
  prevHash: string;
  hash: string;
}

export interface CoverItem {
  id: number;
  item: string;
  limit: number;
}

export interface CountryRecord {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  exponent: number;
  timezone: string;
  callingCode: string;
}
