/* eslint-disable no-console */
import cron from 'node-cron';
import { config } from '../config.js';
import { getDb } from '../db/index.js';
import * as inventoryRepo from '../repositories/inventory.js';
import { notifyUser } from './notificationService.js';
import { runDueReminders } from './refillService.js';
import { createBackup } from './backupService.js';

function settingNumber(key, fallback) {
  const value = Number(getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value);
  return Number.isFinite(value) ? value : fallback;
}

export async function runStockAlerts() {
  const db = getDb();
  let sent = 0;
  const days = settingNumber('expiry_alert_days', config.expiryAlertDays);
  for (const pharmacy of db.prepare('SELECT id, name FROM pharmacies WHERE is_active = 1').all()) {
    const low = inventoryRepo.lowStock(pharmacy.id);
    const alerts = inventoryRepo.expiryAlerts(pharmacy.id, days);
    if (!low.length && !alerts.expiring.length && !alerts.expired.length) continue;
    const pharmacists = db
      .prepare("SELECT id FROM users WHERE role = 'pharmacist' AND pharmacy_id = ? AND is_active = 1")
      .all(pharmacy.id);
    const message =
      `Daily stock alert for ${pharmacy.name}: ${low.length} low-stock item(s), ` +
      `${alerts.expiring.length} expiring within ${days} days and ${alerts.expired.length} expired batch(es) quarantined. ` +
      'Open the alerts page to act.';
    for (const pharmacist of pharmacists) {
      const already = db
        .prepare(
          `SELECT 1 FROM notifications WHERE user_id = ? AND event = 'stock_alert' AND date(created_at) = date('now') LIMIT 1`
        )
        .get(pharmacist.id);
      if (already) continue;
      await notifyUser(pharmacist.id, 'stock_alert', message);
      sent += 1;
    }
  }
  return sent;
}

export function startCronJobs() {
  if (!config.enableCron || config.isTest) return [];
  const jobs = [];

  jobs.push(
    cron.schedule('0 6 * * *', () => {
      runStockAlerts().catch((err) => console.error('[cron] stock alerts failed', err));
    })
  );
  jobs.push(
    cron.schedule('5 6 * * *', () => {
      runDueReminders()
        .then((n) => n && console.log(`[cron] sent ${n} refill reminders`))
        .catch((err) => console.error('[cron] refills failed', err));
    })
  );
  jobs.push(
    cron.schedule(config.backupCron, () => {
      createBackup()
        .then((result) => console.log(`[cron] backup created: ${result.file}`))
        .catch((err) => console.error('[cron] backup failed', err));
    })
  );
  console.log('[cron] daily stock alerts, refill reminders and database backup scheduled');
  return jobs;
}
