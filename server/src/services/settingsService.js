import { getDb } from '../db/index.js';
import { recordAudit } from '../repositories/audit.js';
import { badRequest } from '../utils/http.js';

const DEFINITIONS = {
  expiry_alert_days: { label: 'Expiry alert window (days)', min: 1, max: 730 },
  forecast_window_weeks: { label: 'Forecast moving-average window (weeks)', min: 1, max: 52 },
  forecast_lead_time_days: { label: 'Supplier lead time (days)', min: 1, max: 180 },
  safety_stock_days: { label: 'Safety stock (days of demand)', min: 0, max: 90 },
  backup_retention_days: { label: 'Backup retention (days)', min: 1, max: 365 },
};

export function getSettings() {
  const rows = getDb().prepare('SELECT * FROM app_settings ORDER BY key').all();
  const values = Object.fromEntries(rows.map((row) => [row.key, Number(row.value)]));
  return {
    values,
    items: rows.map((row) => ({
      ...row,
      value: Number(row.value),
      label: DEFINITIONS[row.key]?.label || row.key,
    })),
    definitions: DEFINITIONS,
  };
}

export function updateSettings(user, input) {
  const db = getDb();
  const before = getSettings().values;
  const changes = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!DEFINITIONS[key]) continue;
    const value = Number(raw);
    const def = DEFINITIONS[key];
    if (!Number.isFinite(value) || value < def.min || value > def.max) {
      throw badRequest(`${def.label} must be between ${def.min} and ${def.max}.`);
    }
    changes[key] = value;
  }
  if (!Object.keys(changes).length) throw badRequest('No settings to update.');
  db.transaction(() => {
    const update = db.prepare('UPDATE app_settings SET value = ? WHERE key = ?');
    for (const [key, value] of Object.entries(changes)) update.run(String(value), key);
  })();
  const after = getSettings().values;
  recordAudit({
    userId: user.id,
    action: 'settings_updated',
    entity: 'app_settings',
    entityId: null,
    before,
    after,
  });
  return getSettings();
}
