import Database from 'better-sqlite3';
import { config } from '../config.js';

let dbInstance = null;

/**
 * Opens (once) the shared SQLite connection and applies the safety pragmas.
 * better-sqlite3 is synchronous; every statement in repositories is prepared.
 */
export function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = new Database(config.dbPath);
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('busy_timeout = 5000');
  dbInstance.pragma('synchronous = NORMAL');
  if (config.dbPath !== ':memory:') dbInstance.pragma('journal_mode = WAL');
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Runs fn inside BEGIN IMMEDIATE. Used for order placement, stock movement and
 * payment confirmation so that SQLite takes the write lock up front and the
 * last unit cannot be sold twice.
 */
export function immediateTransaction(fn) {
  const db = getDb();
  const wrapped = db.transaction(fn);
  return wrapped.immediate();
}
