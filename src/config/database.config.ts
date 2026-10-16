/**
 * Whether the standalone claims database is wired up yet. While the platform
 * team's DB is unavailable, run with DB_ENABLED=false — services fall back to
 * mock data and repository providers are not registered. app.module.ts loads
 * dotenv before feature modules are evaluated, so .env is honoured here.
 */
export const DB_ENABLED = process.env.DB_ENABLED === 'true';
