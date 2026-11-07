/* eslint-disable no-console */
import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { closeDb } from './db/index.js';
import { startCronJobs } from './services/cronJobs.js';

migrate();
const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[server] PharmaLink API listening on http://localhost:${config.port}`);
  console.log(`[server] environment=${config.nodeEnv} database=${config.dbPath}`);
});
startCronJobs();

const shutdown = () => {
  console.log('[server] shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
