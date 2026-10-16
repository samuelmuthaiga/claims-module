import { CLAIM_STATUS_LABELS } from '../../../domain/claim.constants';
import { ClaimStatusCode, TERMINAL_STATUSES } from '../../../domain/claim.types';
import { ConfigSeed, WorkflowActionDef, WorkflowDefinition } from '../types/config.types';

const repairRail = [
  'JOB_ORDER_CREATED', 'CUSTOMER_SUBMITTED_FORM', 'PENDING_APPROVAL', 'DIAGNOSIS_IN_PROGRESS',
  'QUOTE_IN_REVIEW', 'REPAIR_ONGOING', 'QUALITY_CONTROL', 'VEHICLE_READY', 'VEHICLE_DELIVERED',
];

// Warranty claims agree the payment split before the quote reaches review.
const warrantyRail = [
  ...repairRail.slice(0, 4), 'QUOTE_SUBMITTED', ...repairRail.slice(4),
];

// BRD 10.4: insurance claims have extra post-repair steps.
const insuranceRail = [
  'JOB_ORDER_CREATED', 'CUSTOMER_SUBMITTED_FORM', 'PENDING_APPROVAL', 'DIAGNOSIS_IN_PROGRESS',
  'QUOTE_SUBMITTED', 'QUOTATION_REVIEW_WITH_INSURANCE', 'REPAIR_ONGOING', 'QUALITY_CONTROL',
  'REPAIR_COMPLETED', 'BALANCE_PAYMENT', 'VEHICLE_READY', 'VEHICLE_DELIVERED',
];

const ACTIVE = (Object.keys(CLAIM_STATUS_LABELS) as ClaimStatusCode[]).filter(
  (code) => !TERMINAL_STATUSES.includes(code),
);

const actions: WorkflowActionDef[] = [
  { action: 'resend_schedule_form', label: 'Resend Scheduling Link', from: ['JOB_ORDER_CREATED'], permission: 'claims:write', inputSchemaRef: null, endpoint: '/v1/claims/:id/schedule-link/resends', method: 'POST' },
  { action: 'request_diagnosis_approval', label: 'Request Diagnosis Approval', from: ['CUSTOMER_SUBMITTED_FORM'], permission: 'claims:write', inputSchemaRef: 'diagnosis-approval-request', endpoint: '/v1/claims/:id/diagnosis-approval-requests', method: 'POST' },
  { action: 'upload_quote', label: 'Upload Quote', from: ['DIAGNOSIS_IN_PROGRESS'], permission: 'claims:write', inputSchemaRef: 'quote-upload', endpoint: '/v1/claims/:id/quotes', method: 'POST' },
  { action: 'submit_payment_split', label: 'Submit Payment Split', from: ['QUOTE_SUBMITTED'], permission: 'claims:write', inputSchemaRef: 'payment-split', endpoint: '/v1/claims/:id/payment-split', method: 'PUT' },
  { action: 'complete_repair', label: 'Complete Repair', from: ['REPAIR_ONGOING'], permission: 'claims:write', inputSchemaRef: 'repair-completion', endpoint: '/v1/claims/:id/repair-completion', method: 'POST' },
  { action: 'complete_pickup', label: 'Complete Pickup', from: ['VEHICLE_READY'], permission: 'claims:write', inputSchemaRef: 'vehicle-pickup', endpoint: '/v1/claims/:id/pickup', method: 'POST' },
  { action: 'cancel_claim', label: 'Cancel Claim', from: ACTIVE, permission: 'claims:write', requiresReason: true, inputSchemaRef: 'claim-cancel', endpoint: '/v1/claims/:id/cancellation', method: 'POST' },
];

export const DEFAULT_WORKFLOW: WorkflowDefinition = {
  statuses: (Object.keys(CLAIM_STATUS_LABELS) as ClaimStatusCode[]).map((code) => ({
    code,
    label: CLAIM_STATUS_LABELS[code],
    ...(TERMINAL_STATUSES.includes(code) ? { terminal: true } : {}),
  })),
  rails: { REPAIRS: repairRail, WARRANTY: warrantyRail, INSURANCE: insuranceRail },
  actions,
  reviewTargets: {
    PENDING_APPROVAL: { label: 'Review request', approvalType: 'DIAGNOSIS' },
    QUOTE_IN_REVIEW: { label: 'Review quote', approvalType: 'QUOTE' },
    QUOTATION_REVIEW_WITH_INSURANCE: { label: 'Review quote', approvalType: 'QUOTE' },
    QUALITY_CONTROL: { label: 'Review QC', approvalType: 'QA_SIGNOFF' },
  },
};

export const WORKFLOW_CONFIGS: ConfigSeed[] = [
  {
    key: 'claim-workflow',
    type: 'WORKFLOW',
    title: 'Claim Workflow',
    description: 'Statuses, per-claim-type rails, action eligibility and review targets.',
    domain: 'claims',
    metaData: DEFAULT_WORKFLOW as unknown as Record<string, any>,
  },
];
