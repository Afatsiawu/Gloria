import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(__dirname, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

// Load .env from the repository root, then let server/.env override it.
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });
dotenv.config({ path: path.join(SERVER_ROOT, '.env'), override: true });

const resolvePath = (p, fallback) => {
  const value = p || fallback;
  return path.isAbsolute(value) ? value : path.resolve(SERVER_ROOT, value);
};

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest: process.env.NODE_ENV === 'test',
  isProduction: process.env.NODE_ENV === 'production',
  port: num(process.env.PORT, 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  dbPath: process.env.DB_PATH === ':memory:' ? ':memory:' : resolvePath(process.env.DB_PATH, './data/pharmacy.db'),
  uploadsDir: resolvePath(process.env.UPLOADS_DIR, './uploads'),
  prescriptionsDir: resolvePath(process.env.PRESCRIPTIONS_DIR, './uploads/prescriptions'),
  backupsDir: resolvePath(process.env.BACKUPS_DIR, './backups'),
  reportsDir: resolvePath(process.env.REPORTS_DIR, './reports'),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: Math.max(10, num(process.env.BCRYPT_ROUNDS, 10)),
  cookieSecure: bool(process.env.COOKIE_SECURE, process.env.NODE_ENV === 'production'),
  autoSeed: bool(process.env.AUTO_SEED, false),
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  smsProvider: process.env.SMS_PROVIDER || 'mock',
  emailProvider: process.env.EMAIL_PROVIDER || 'mock',
  mockPaymentFailureRate: num(process.env.MOCK_PAYMENT_FAILURE_RATE, 0),
  mockPaymentDelayMs: num(process.env.MOCK_PAYMENT_DELAY_MS, 4000),
  expiryAlertDays: num(process.env.EXPIRY_ALERT_DAYS, 90),
  forecastWindowWeeks: num(process.env.FORECAST_WINDOW_WEEKS, 4),
  forecastLeadTimeDays: num(process.env.FORECAST_LEAD_TIME_DAYS, 7),
  safetyStockDays: num(process.env.SAFETY_STOCK_DAYS, 3),
  backupRetentionDays: num(process.env.BACKUP_RETENTION_DAYS, 14),
  backupCron: process.env.BACKUP_CRON || '0 2 * * *',
  enableCron: bool(process.env.ENABLE_CRON, true),
};

for (const dir of [config.prescriptionsDir, config.backupsDir, config.reportsDir]) {
  fs.mkdirSync(dir, { recursive: true });
}
if (config.dbPath !== ':memory:') fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
