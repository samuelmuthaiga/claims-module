import { registerAs } from '@nestjs/config';

const toBool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value === '' ? fallback : value === 'true';

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toList = (value: string | undefined, fallback: string[]): string[] => {
  const items = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
};

export default registerAs('claims', () => ({
  app: {
    env: process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    port: toInt(process.env.PORT, 3000),
    serviceName: process.env.SERVICE_NAME ?? 'backend-claims-service',
    logStack: toBool(process.env.LOG_STACK, false),
    globalPrefix: process.env.API_GLOBAL_PREFIX ?? '',
    corsOrigins: toList(process.env.CORS_ORIGINS, []),
    uiBaseUrl: process.env.CLAIMS_UI_BASE_URL ?? 'http://localhost:5173',
    disableAuth: toBool(process.env.DISABLE_AUTH, false),
    disableAuthUserId: process.env.DISABLE_AUTH_USER_ID ?? 'user-207',
    disableAuthUserRoles: toList(process.env.DISABLE_AUTH_USER_ROLES, [
      'CLAIMS_ADMIN',
    ]),
  },
  auth: {
    jwtSecret: process.env.AUTH_JWT_SECRET ?? '',
    jwtAlgorithm: process.env.AUTH_JWT_ALGORITHM ?? 'HS512',
    jwtIssuer: process.env.AUTH_JWT_ISSUER ?? '',
    jwtAudience: process.env.AUTH_JWT_AUDIENCE ?? '',
    accessTokenTtlSeconds: toInt(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS, 3600),
  },
  workflow: {
    makerCheckerEnabled: toBool(process.env.MAKER_CHECKER_ENABLED, true),
  },
  database: {
    enabled: toBool(process.env.DB_ENABLED, false),
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 5432),
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'claims',
    ssl: toBool(process.env.DB_SSL, false),
  },
  swagger: {
    title: process.env.SWAGGER_TITLE ?? 'Claims Service',
    description:
      process.env.SWAGGER_DESCRIPTION ?? 'API documentation for the claims service',
    version: process.env.SWAGGER_VERSION ?? '1.0.0',
  },
}));
