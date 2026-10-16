import { ENUMS } from '../../../domain/enums';
import { ConfigInputType as T } from '../enums/config-input-type.enum';
import { ConfigSeed } from '../types/config.types';

const countryFilter = {
  key: 'country',
  type: T.SELECT,
  label: 'Country',
  placeholder: 'Country',
  options_source: { type: 'api', method: 'GET', url: '/v1/lookups/countries', dataPath: 'data', labelKey: 'name', valueKey: 'code' },
};

const select = (key: string, label: string, options: { value: string; label: string }[]) => ({
  key, type: T.SELECT, label, placeholder: label, options,
});

const searchTypes = (...rows: [string, string][]) =>
  rows.map(([value, label]) => ({ value, label: `Search by ${label}` }));

const filters = (
  key: string,
  title: string,
  domain: string,
  types: { value: string; label: string }[],
  fields: Record<string, unknown>[],
): ConfigSeed => ({
  key, type: 'FILTERS', title, domain,
  metaData: { searchTypes: types, searchPlaceholder: 'Search', fields },
});

/** Filter bars for every list screen (previously hard-coded per page in the UI). */
export const FILTER_CONFIGS: ConfigSeed[] = [
  filters('claims-filters', 'Claim Requests Filters', 'claims',
    searchTypes(['CLAIM_ID', 'Claim ID'], ['VIN', 'VIN'], ['LOAN_ID', 'Loan ID'], ['CAR_ID', 'Car ID'], ['PLATE_NUMBER', 'Plate Number'], ['CUSTOMER_NAME', 'Customer Name'], ['CUSTOMER_EMAIL', 'Customer Email']),
    [countryFilter, select('status', 'Status', ENUMS.claimStatuses), select('claimType', 'Claim Type', ENUMS.claimTypes)]),
  filters('reviews-filters', 'Approvals Filters', 'approvals',
    searchTypes(['ID', 'ID'], ['CLAIM_ID', 'Claim ID'], ['CUSTOMER_NAME', 'Customer Name'], ['CUSTOMER_EMAIL', 'Customer Email'], ['VENDOR', 'Vendor']),
    [countryFilter]),
  filters('payments-filters', 'Payments Filters', 'payments',
    searchTypes(['ID', 'Payment ID'], ['CUSTOMER_NAME', 'Customer Name'], ['CUSTOMER_EMAIL', 'Customer Email'], ['VENDOR', 'Vendor']),
    [countryFilter, select('paymentStatus', 'Payment Status', ENUMS.paymentStatuses)]),
  filters('payment-approvals-filters', 'Payment Approvals Filters', 'payments',
    searchTypes(['ID', 'Payment ID'], ['CUSTOMER_NAME', 'Customer Name'], ['DESCRIPTION', 'Description'], ['ACCOUNT_NAME', 'Account Name']),
    [countryFilter]),
  filters('parts-pricing-filters', 'Parts Pricing Filters', 'parts-pricing',
    searchTypes(['PART_NAME', 'Part Name'], ['WORKSHOP', 'Workshop'], ['VEHICLE', 'Vehicle']),
    [select('category', 'Category', ENUMS.repairCategories)]),
  filters('audit-logs-filters', 'Audit Logs Filters', 'audit-logs',
    searchTypes(['LOG_ID', 'Log ID'], ['ACTION', 'Action'], ['PERFORMED_BY', 'Performed By'], ['ENTITY_ID', 'Entity ID']),
    [select('entityType', 'Entity Type', ENUMS.auditEntityTypes), select('module', 'Module', ENUMS.auditModules)]),
];
