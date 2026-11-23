/* eslint-disable no-console */
import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { getDb, closeDb } from './db/index.js';
import { startCronJobs } from './services/cronJobs.js';

migrate();

if (config.autoSeed) {
  const count = getDb().prepare("SELECT COUNT(*) AS n FROM users").get()?.n || 0;
  if (count === 0) {
    console.log('[server] empty database detected; running seed...');
    const { seed } = await import('./db/seed.js');
    await seed();
  }
}

const app = createApp();

// Vercel (and other serverless hosts) import this module and expect the Express
// app to be exported rather than listening on a port. Long-running hosts use
// app.listen() below.
export default app;

if (!process.env.VERCEL) {
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
}
