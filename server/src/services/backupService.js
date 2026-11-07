import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { getDb } from '../db/index.js';

/**
 * Online backup using better-sqlite3's backup API (safe while WAL is active).
 * Files stay outside the web root and are pruned by retention days.
 */
export async function createBackup() {
  if (config.dbPath === ':memory:') return { file: null, message: 'In-memory database is not backed up.' };
  fs.mkdirSync(config.backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const file = path.join(config.backupsDir, `pharmacy-${stamp}.db`);
  await getDb().backup(file);
  pruneBackups();
  return { file: path.basename(file), path: file, size_bytes: fs.statSync(file).size };
}

export function pruneBackups() {
  const retentionDays = Number(
    getDb().prepare("SELECT value FROM app_settings WHERE key = 'backup_retention_days'").get()?.value ??
      config.backupRetentionDays
  );
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  if (!fs.existsSync(config.backupsDir)) return [];
  const removed = [];
  for (const name of fs.readdirSync(config.backupsDir)) {
    if (!name.endsWith('.db')) continue;
    const full = path.join(config.backupsDir, name);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full);
      removed.push(name);
    }
  }
  return removed;
}

export function listBackups() {
  if (!fs.existsSync(config.backupsDir)) return [];
  return fs
    .readdirSync(config.backupsDir)
    .filter((name) => name.endsWith('.db'))
    .map((name) => {
      const stat = fs.statSync(path.join(config.backupsDir, name));
      return { file: name, size_bytes: stat.size, created_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
