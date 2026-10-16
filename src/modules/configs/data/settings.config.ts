import { ClaimsSettings, ConfigSeed } from '../types/config.types';

export const DEFAULT_SETTINGS: ClaimsSettings = {
  // BRD 10.9: warranty repairs may not exceed 25% of the vehicle price.
  warrantyCapPercentage: 25,
  dualApprovalThreshold: 500_000,
  approvalSlaHours: 48,
  scheduleLink: { ttlHours: 48, resendCap: 3, resendWindowHours: 24 },
  appointment: {
    minDaysInAdvance: 1,
    maxDaysInAdvance: 30,
    slotMinutes: 60,
    workingHours: { start: '08:00', end: '17:00', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
  },
  quote: { minQuantity: 0.5, maxQuantity: 10, quantityStep: 0.5 },
  payment: { vatRate: 0.075, serviceChargeRate: 0.015 },
  files: { maxSizeMb: 20, allowedTypes: ['.pdf', '.jpg', '.jpeg', '.png'] },
  pagination: { defaultPageSize: 10, carSearchPageSize: 8 },
  featureFlags: { qaAdminSignoff: true },
};

export const SETTINGS_CONFIGS: ConfigSeed[] = [
  {
    key: 'claims-settings',
    type: 'SETTINGS',
    title: 'Claims Settings',
    description: 'Business constants shared by the claims services and the UI.',
    domain: 'platform',
    metaData: DEFAULT_SETTINGS as unknown as Record<string, any>,
  },
];
