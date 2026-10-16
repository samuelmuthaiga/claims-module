import { ClaimStatus, ClaimStatusCode } from './claim.types';

export const CLAIM_STATUS_LABELS: Record<ClaimStatusCode, string> = {
  [ClaimStatus.JOB_ORDER_CREATED]: 'Job Order Created',
  [ClaimStatus.CUSTOMER_SUBMITTED_FORM]: 'Customer Submitted Form',
  [ClaimStatus.PENDING_APPROVAL]: 'Pending Approval',
  [ClaimStatus.DIAGNOSIS_IN_PROGRESS]: 'Diagnosis in Progress',
  [ClaimStatus.QUOTE_SUBMITTED]: 'Quote Submitted',
  [ClaimStatus.QUOTE_IN_REVIEW]: 'Quote In Review',
  [ClaimStatus.QUOTATION_REVIEW_WITH_INSURANCE]: 'Quotation Review with Insurance',
  [ClaimStatus.DISCHARGE_VOUCHER_SHARED]: 'Discharge Voucher Shared',
  [ClaimStatus.REPAIR_ONGOING]: 'Repair Ongoing',
  [ClaimStatus.QUALITY_CONTROL]: 'Quality Control',
  [ClaimStatus.REPAIR_COMPLETED]: 'Repair Completed',
  [ClaimStatus.BALANCE_PAYMENT]: 'Balance Payment',
  [ClaimStatus.VEHICLE_READY]: 'Vehicle Ready',
  [ClaimStatus.VEHICLE_DELIVERED]: 'Vehicle Delivered',
  [ClaimStatus.CANCELLED]: 'Cancelled',
};

export const statusLabel = (code: string): string =>
  CLAIM_STATUS_LABELS[code as ClaimStatusCode] ?? code;

export const round2 = (value: number): number => Math.round(value * 100) / 100;
