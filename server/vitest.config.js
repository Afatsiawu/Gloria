import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, 'src', 'test', 'tmp');

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.js'],
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    env: {
      NODE_ENV: 'test',
      DB_PATH: ':memory:',
      JWT_SECRET: 'test-only-secret',
      BCRYPT_ROUNDS: '10',
      MOCK_PAYMENT_DELAY_MS: '0',
      MOCK_PAYMENT_FAILURE_RATE: '0',
      ENABLE_CRON: 'false',
      PAYMENT_PROVIDER: 'mock',
      SMS_PROVIDER: 'mock',
      EMAIL_PROVIDER: 'mock',
      CLIENT_ORIGIN: 'http://localhost:5173',
      UPLOADS_DIR: path.join(tmp, 'uploads'),
      PRESCRIPTIONS_DIR: path.join(tmp, 'uploads', 'prescriptions'),
      BACKUPS_DIR: path.join(tmp, 'backups'),
      REPORTS_DIR: path.join(tmp, 'reports'),
    },
  },
});
