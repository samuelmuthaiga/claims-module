/** Permission strings carried in the API spec (`claims:read`, `reviews:approve`, ...). */
export const Permission = {
  CLAIMS_READ: 'claims:read',
  CLAIMS_WRITE: 'claims:write',
  REVIEWS_READ: 'reviews:read',
  REVIEWS_APPROVE: 'reviews:approve',
  PAYMENTS_READ: 'payments:read',
  PAYMENTS_WRITE: 'payments:write',
  PAYMENTS_APPROVE: 'payments:approve',
  PARTS_READ: 'parts:read',
  AUDIT_READ: 'audit:read',
  CONFIGS_READ: 'configs:read',
  CONFIGS_MANAGE: 'configs:manage',
} as const;

export type PermissionValue = (typeof Permission)[keyof typeof Permission];

/** Role names are the ones the Claims UI already gates on (constants/allowedRoles). */
export const Role = {
  ADMIN: 'CLAIMS_ADMIN',
  OFFICER: 'CLAIMS_OFFICER',
  READ_ONLY: 'CLAIMS_READONLY',
} as const;

const ALL = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [Role.ADMIN]: ALL,
  [Role.OFFICER]: [
    Permission.CLAIMS_READ,
    Permission.CLAIMS_WRITE,
    Permission.REVIEWS_READ,
    Permission.PAYMENTS_READ,
    Permission.PAYMENTS_WRITE,
    Permission.PARTS_READ,
    Permission.AUDIT_READ,
    Permission.CONFIGS_READ,
  ],
  [Role.READ_ONLY]: [
    Permission.CLAIMS_READ,
    Permission.REVIEWS_READ,
    Permission.PAYMENTS_READ,
    Permission.PARTS_READ,
    Permission.CONFIGS_READ,
  ],
};

export const permissionsForRoles = (roles: string[], extra: string[] = []): string[] =>
  Array.from(new Set([...roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []), ...extra]));

export const primaryRole = (roles: string[]): string =>
  [Role.ADMIN, Role.OFFICER, Role.READ_ONLY].find((role) => roles.includes(role)) ??
  roles[0] ??
  Role.READ_ONLY;
