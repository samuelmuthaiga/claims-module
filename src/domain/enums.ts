import { CLAIM_STATUS_LABELS } from './claim.constants';
import { ClaimStatusCode } from './claim.types';

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

const opt = <T extends string>(value: T, label: string): Option<T> => ({ value, label });

/**
 * Canonical option lists. Both `GET /v1/lookups/enums` and the form/filter
 * configs are built from these so the two can never disagree.
 */
export const ENUMS = {
  claimTypes: [opt('WARRANTY', 'Warranty'), opt('REPAIRS', 'Repairs'), opt('INSURANCE', 'Insurance')],
  warrantyTypes: [opt('LOAN_WARRANTY', 'Loan Warranty'), opt('CASH_WARRANTY', 'Cash Warranty')],
  requestChannels: [opt('PHONE_CALL', 'Phone Call'), opt('EMAIL', 'Email')],
  claimStatuses: (Object.keys(CLAIM_STATUS_LABELS) as ClaimStatusCode[]).map((code) =>
    opt(code, CLAIM_STATUS_LABELS[code]),
  ),
  paymentStatuses: [
    opt('PENDING', 'Pending'),
    opt('PENDING_APPROVAL', 'Pending Approval'),
    opt('DISPUTED', 'Disputed'),
    opt('APPROVED', 'Approved'),
    opt('INVOICE_DECLINED', 'Invoice Declined'),
    opt('PAID', 'Paid'),
  ],
  paymentKinds: [opt('UPFRONT', 'Upfront'), opt('BALANCE', 'Balance')],
  approvalTypes: [
    opt('DIAGNOSIS', 'Diagnosis Request'),
    opt('QUOTE', 'Quote'),
    opt('QA_SIGNOFF', 'Quality Control'),
    opt('PAYMENT', 'Payment'),
  ],
  approvalStatuses: [opt('PENDING', 'Pending'), opt('APPROVED', 'Approved'), opt('DECLINED', 'Declined')],
  qaResults: [opt('PASS', 'Pass'), opt('FAIL', 'Fail')],
  qaStates: [
    opt('ASSIGNED', 'Assigned'),
    opt('IN_PROGRESS', 'In Progress'),
    opt('CORRECTIVE_ACTION_REQUIRED', 'Corrective Action Required'),
    opt('PASSED', 'Passed'),
    opt('CANCELLED', 'Cancelled'),
  ],
  repairCategories: [
    opt('TRANSMISSION', 'Transmission / Gearbox'),
    opt('ENGINE', 'Engine'),
    opt('BRAKING', 'Braking System'),
    opt('SUSPENSION', 'Suspension'),
    opt('BODY', 'Body Work'),
    opt('ELECTRICAL', 'Electrical'),
    opt('LIGHTING', 'Lighting'),
    opt('COOLING', 'Cooling System'),
    opt('LABOUR', 'Labour'),
  ],
  partConditions: [opt('NEW', 'Brand New'), opt('USED', 'Used'), opt('REFURBISHED', 'Refurbished')],
  trackerStatuses: [opt('Active', 'Active'), opt('Inactive', 'Inactive'), opt('Unknown', 'Unknown')],
  cancelReasons: [
    opt('Customer Request', 'Customer Request'),
    opt('Duplicate Entry', 'Duplicate Entry'),
    opt('Incorrect Information', 'Incorrect Information'),
    opt('Others', 'Others'),
  ],
  auditModules: [opt('CLAIMS', 'Claims'), opt('APPROVALS', 'Approvals'), opt('PAYMENTS', 'Payments'), opt('CONFIGS', 'Configs')],
  auditEntityTypes: [
    opt('claim', 'Claim Request'),
    opt('quote', 'Quote'),
    opt('approval', 'Approval'),
    opt('payment', 'Payment'),
    opt('config', 'Config'),
  ],
  auditSeverities: [opt('INFO', 'Info'), opt('WARNING', 'Warning'), opt('CRITICAL', 'Critical')],
} satisfies Record<string, Option[]>;

export type EnumName = keyof typeof ENUMS;

export const values = (name: EnumName): string[] => ENUMS[name].map((o) => o.value);
