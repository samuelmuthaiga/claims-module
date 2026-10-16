import { ConfigSeed } from '../types/config.types';

type Format = 'text' | 'badge' | 'currency' | 'date' | 'datetime' | 'person' | 'vehicle' | 'number';

const col = (key: string, label: string, path: string, format: Format = 'text', extra: Record<string, unknown> = {}) => ({
  key, label, path, format, ...extra,
});

const table = (
  key: string,
  title: string,
  domain: string,
  endpoint: string,
  columns: Record<string, unknown>[],
  extra: Record<string, unknown> = {},
): ConfigSeed => ({
  key, type: 'TABLE', title, domain,
  metaData: {
    endpoint,
    rowKey: 'id',
    pageSize: 10,
    columns,
    ...extra,
  },
});

const customer = col('customer', 'Customer', 'customer', 'person');
const vehicle = col('vehicle', 'Vehicle', 'car', 'vehicle');

/**
 * Column definitions for each list screen. `path` is a dot path into the row
 * returned by `endpoint`; `format` tells the renderer how to display it.
 */
export const TABLE_CONFIGS: ConfigSeed[] = [
  table('claims-table', 'Claim Requests', 'claims', '/v1/claims', [
    col('id', 'ID', 'id', 'number', { sortable: true }),
    col('claimType', 'Type', 'claimType', 'badge'),
    col('country', 'Country', 'country', 'badge'),
    customer, vehicle,
    col('vendor', 'Workshop', 'vendor.name'),
    col('issueSubType', 'Issue', 'issueSubType'),
    col('status', 'Status', 'statusLabel', 'badge', { valuePath: 'status', sortable: true }),
    col('requestDate', 'Request Date', 'requestDate', 'date', { sortable: true }),
  ], {
    defaultSort: 'created_at:desc',
    sortFields: ['created_at', 'request_date', 'status', 'id'],
    onRowClick: { route: '/claim-requests/:id' },
    // Row actions come from the workflow so the table and detail page never drift.
    rowActions: { source: 'workflow', workflow: 'claim-workflow', filtersBy: 'status' },
    summary: { endpoint: '/v1/claims/summary', cards: [
      { key: 'vehiclesInWorkshop', label: 'Vehicles in Workshop' },
      { key: 'repair', label: 'Repairs' }, { key: 'warranty', label: 'Warranty' }, { key: 'insurance', label: 'Insurance' },
    ] },
  }),

  table('review-requests-table', 'Diagnosis Requests', 'approvals', '/v1/approvals?type=DIAGNOSIS', [
    col('id', 'ID', 'id', 'number'), col('claimId', 'Claim ID', 'claimId', 'number'),
    customer, vehicle, col('vendor', 'Workshop', 'vendor.name'), col('submittedAt', 'Submitted', 'submittedAt', 'datetime'),
  ], { onRowClick: { route: '/reviews/requests/:id' } }),
  table('review-quotes-table', 'Quote Approvals', 'approvals', '/v1/approvals?type=QUOTE', [
    col('id', 'ID', 'id', 'number'), col('claimId', 'Claim ID', 'claimId', 'number'),
    customer, vehicle, col('vendor', 'Workshop', 'vendor.name'),
    col('upfrontAmount', 'Upfront', 'upfrontAmount', 'currency', { currencyPath: 'currency' }),
    col('amount', 'Total', 'amount', 'currency', { currencyPath: 'currency' }),
  ], { onRowClick: { route: '/reviews/quotes/:id' } }),
  table('review-repairs-table', 'QC Sign-off', 'approvals', '/v1/approvals?type=QA_SIGNOFF', [
    col('id', 'ID', 'id', 'number'), col('claimId', 'Claim ID', 'claimId', 'number'),
    customer, vehicle, col('vendor', 'Workshop', 'vendor.name'), col('submittedAt', 'Completed', 'submittedAt', 'datetime'),
  ], { onRowClick: { route: '/reviews/repairs/:id' }, summary: { endpoint: '/v1/approvals/summary' } }),

  table('payment-quotes-table', 'Quote Payments', 'payments', '/v1/payments/quotes', [
    col('id', 'ID', 'id', 'number'), col('claimType', 'Type', 'claimType', 'badge'), col('country', 'Country', 'country', 'badge'),
    customer, vehicle, col('vendor', 'Vendor', 'payeeVendorName'),
    col('amount', 'Amount', 'amount', 'currency', { currencyPath: 'currency' }),
    col('paymentStatus', 'Payment Status', 'status', 'badge'), col('requestDate', 'Requested', 'requestDate', 'date'),
  ], { onRowClick: { route: '/payments/quotes/:id' }, summary: { endpoint: '/v1/payments/summary' } }),
  table('payment-repairs-table', 'Repair Payments', 'payments', '/v1/payments/repairs', [
    col('id', 'ID', 'id', 'number'), col('claimType', 'Type', 'claimType', 'badge'), col('country', 'Country', 'country', 'badge'),
    customer, vehicle, col('vendor', 'Vendor', 'payeeVendorName'),
    col('repairAmount', 'Repair Amount', 'amount', 'currency', { currencyPath: 'currency' }),
    col('paymentStatus', 'Payment Status', 'status', 'badge'), col('repairDate', 'Repair Date', 'repairDate', 'date'),
  ], { onRowClick: { route: '/payments/repairs/:id' } }),
  table('payment-approvals-table', 'Payment Approvals', 'payments', '/v1/payments/approvals', [
    col('id', 'ID', 'id', 'number'), col('paymentType', 'Payment Type', 'kind', 'badge'),
    col('description', 'Description', 'description'), col('accountName', 'Account Name', 'accountName'),
    customer, col('amount', 'Amount', 'amount', 'currency', { currencyPath: 'currency' }),
    col('requestDate', 'Requested', 'submittedAt', 'datetime'),
  ]),

  table('parts-pricing-table', 'Parts Pricing', 'parts-pricing', '/v1/parts-pricing', [
    col('partName', 'Part', 'partName'), col('workshop', 'Workshop', 'workshop'), col('carLabel', 'Vehicle', 'carLabel'),
    col('approvedPrice', 'Approved Price', 'approvedPrice', 'currency', { currencyPath: 'currency', sortable: true }),
    col('approvedDate', 'Approved', 'approvedDate', 'date', { sortable: true }), col('claimId', 'Claim ID', 'claimId', 'number'),
  ], { defaultSort: 'approved_date:desc' }),
  table('audit-logs-table', 'Audit Logs', 'audit-logs', '/v1/audit-logs', [
    col('id', 'Log ID', 'id'), col('action', 'Action', 'action', 'badge'), col('entityType', 'Entity', 'entityTypeLabel'),
    col('entityId', 'Entity ID', 'entityId'), col('performedBy', 'Performed By', 'performedBy'),
    col('role', 'Role', 'role', 'badge'), col('timestamp', 'Time', 'timestamp', 'datetime', { sortable: true }),
  ], { onRowClick: { route: '/audit-logs/:id' }, pageSize: 20 }),
];
