export const CONFIG_TYPES = ['FORM', 'FILTERS', 'TABLE', 'WORKFLOW', 'SETTINGS'] as const;
export type ConfigType = (typeof CONFIG_TYPES)[number];

export interface ConfigAction {
  key: string;
  label: string;
  style?: 'primary' | 'danger' | 'secondary';
  /** Route the UI calls; `:param` segments are filled from the entity context. */
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Permission needed to see/use the action (UI gates buttons on this). */
  permission?: string;
  confirm?: { title: string; text: string };
}

export interface ConfigDefinition {
  id: string;
  key: string;
  type: ConfigType;
  title: string;
  description?: string | null;
  domain: string;
  /** '*' applies to every country; a country code overrides the global entry. */
  country: string;
  metaData: Record<string, any>;
  actions: ConfigAction[] | null;
  isActive: boolean;
  version: number;
  etag: string;
  createdAt: string;
  updatedAt: string;
}

export type ConfigSeed = Omit<
  ConfigDefinition,
  'id' | 'etag' | 'version' | 'createdAt' | 'updatedAt' | 'isActive' | 'country' | 'description' | 'actions'
> &
  Partial<Pick<ConfigDefinition, 'description' | 'actions' | 'country'>>;

/** Business constants the services and the UI both rely on (config key `claims-settings`). */
export interface ClaimsSettings {
  warrantyCapPercentage: number;
  dualApprovalThreshold: number;
  approvalSlaHours: number;
  scheduleLink: { ttlHours: number; resendCap: number; resendWindowHours: number };
  appointment: {
    minDaysInAdvance: number;
    maxDaysInAdvance: number;
    slotMinutes: number;
    workingHours: { start: string; end: string; days: string[] };
  };
  quote: { minQuantity: number; maxQuantity: number; quantityStep: number };
  payment: { vatRate: number; serviceChargeRate: number };
  files: { maxSizeMb: number; allowedTypes: string[] };
  pagination: { defaultPageSize: number; carSearchPageSize: number };
  featureFlags: { qaAdminSignoff: boolean };
}

export interface WorkflowActionDef {
  action: string;
  label: string;
  /** Claim statuses in which the action is available. */
  from: string[];
  permission: string;
  requiresReason?: boolean;
  /** Key of the FORM config that renders this action's input. */
  inputSchemaRef: string | null;
  endpoint: string;
  method: 'POST' | 'PUT';
  /** Restrict to claim types; omitted = all. */
  claimTypes?: string[];
  disabledHint?: string;
}

export interface WorkflowDefinition {
  statuses: { code: string; label: string; terminal?: boolean }[];
  rails: Record<string, string[]>;
  actions: WorkflowActionDef[];
  reviewTargets: Record<string, { label: string; approvalType: string }>;
}
