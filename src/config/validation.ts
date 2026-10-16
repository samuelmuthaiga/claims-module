import * as Joi from 'joi';

const PRODUCTION_ENVS = ['production', 'prod', 'staging'];
const isProduction = Joi.string().valid(...PRODUCTION_ENVS);

const requiredInProd = Joi.when('NODE_ENV', {
  is: isProduction,
  then: Joi.string().trim().required(),
  otherwise: Joi.string().allow('').optional(),
});

const bool = Joi.boolean().truthy('true').falsy('false');

/**
 * Environment validation. Mirrors the Fleetzen approach: strict in
 * production/staging, forgiving locally so the UI team can run on defaults.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'staging', 'production', 'prod')
    .optional(),
  ENVIRONMENT: Joi.string().allow('').optional(),
  PORT: Joi.number().port().optional(),
  SERVICE_NAME: Joi.string().allow('').optional(),
  LOG_STACK: bool.optional(),
  API_GLOBAL_PREFIX: Joi.string().allow('').optional(),
  CORS_ORIGINS: Joi.string().allow('').optional(),
  CLAIMS_UI_BASE_URL: Joi.string().uri().allow('').optional(),

  // Auth. The bypass can never be switched on in a deployed environment.
  DISABLE_AUTH: Joi.when('NODE_ENV', {
    is: isProduction,
    then: Joi.boolean().valid(false).optional(),
    otherwise: bool.optional(),
  }),
  DISABLE_AUTH_USER_ID: Joi.string().allow('').optional(),
  DISABLE_AUTH_USER_ROLES: Joi.string().allow('').optional(),
  AUTH_JWT_SECRET: Joi.when('NODE_ENV', {
    is: isProduction,
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  AUTH_JWT_ALGORITHM: Joi.string().valid('HS256', 'HS384', 'HS512').optional(),
  AUTH_JWT_ISSUER: Joi.string().allow('').optional(),
  AUTH_JWT_AUDIENCE: Joi.string().allow('').optional(),
  AUTH_ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).optional(),

  MAKER_CHECKER_ENABLED: bool.optional(),

  // Standalone claims database (never the Fleetzen DB).
  DB_ENABLED: bool.optional(),
  DB_HOST: Joi.when('DB_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  DB_PORT: Joi.number().port().optional(),
  DB_USER: requiredInProd.optional(),
  DB_PASSWORD: Joi.when('DB_ENABLED', {
    is: true,
    then: Joi.string().trim().required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  DB_NAME: Joi.string().allow('').optional(),
  DB_SSL: bool.optional(),
  DB_MAX_CONNECTIONS: Joi.number().integer().min(1).optional(),
  DB_MIN_CONNECTIONS: Joi.number().integer().min(1).optional(),

  SWAGGER_TITLE: Joi.string().allow('').optional(),
  SWAGGER_DESCRIPTION: Joi.string().allow('').optional(),
  SWAGGER_VERSION: Joi.string().allow('').optional(),
}).unknown(true);
