import { getDb } from '../db/index.js';
import { notifyUser } from './notificationService.js';
import { badRequest, notFound } from '../utils/http.js';

export function list(userId) {
  return getDb()
    .prepare(
      `SELECT r.*, m.brand_name, m.generic_name, m.strength, m.dosage_form, m.requires_prescription
         FROM refill_reminders r JOIN medicines m ON m.id = r.medicine_id
        WHERE r.user_id = ? ORDER BY r.next_due_at ASC`
    )
    .all(userId);
}

export function upsert(userId, input) {
  const medicine = getDb().prepare('SELECT id FROM medicines WHERE id = ? AND is_active = 1').get(input.medicineId);
  if (!medicine) throw notFound('Medicine not found.');
  const nextDue = input.nextDueAt
    ? input.nextDueAt
    : new Date(Date.now() + (input.intervalDays || 30) * 24 * 60 * 60 * 1000).toISOString();
  const db = getDb();
  db.prepare(
    `INSERT INTO refill_reminders (user_id, medicine_id, interval_days, next_due_at, is_active)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT (user_id, medicine_id) DO UPDATE SET interval_days = excluded.interval_days,
       next_due_at = excluded.next_due_at, is_active = 1`
  ).run(userId, input.medicineId, input.intervalDays || 30, nextDue);
  return db
    .prepare(
      `SELECT r.*, m.brand_name, m.generic_name FROM refill_reminders r JOIN medicines m ON m.id = r.medicine_id
        WHERE r.user_id = ? AND r.medicine_id = ?`
    )
    .get(userId, input.medicineId);
}

export function update(userId, id, input) {
  const db = getDb();
  const reminder = db.prepare('SELECT * FROM refill_reminders WHERE id = ? AND user_id = ?').get(id, userId);
  if (!reminder) throw notFound('Reminder not found.');
  if (input.intervalDays !== undefined) {
    if (input.intervalDays < 1) throw badRequest('Interval must be at least one day.');
  }
  const interval = input.intervalDays ?? reminder.interval_days;
  const isActive = input.isActive === undefined ? reminder.is_active : input.isActive ? 1 : 0;
  const nextDue = input.nextDueAt ?? reminder.next_due_at;
  db.prepare('UPDATE refill_reminders SET interval_days = ?, is_active = ?, next_due_at = ? WHERE id = ?').run(
    interval,
    isActive,
    nextDue,
    id
  );
  return db.prepare('SELECT * FROM refill_reminders WHERE id = ?').get(id);
}

export function remove(userId, id) {
  const result = getDb().prepare('DELETE FROM refill_reminders WHERE id = ? AND user_id = ?').run(id, userId);
  if (!result.changes) throw notFound('Reminder not found.');
}

/** Cron target: create a notification for every due reminder and advance it. */
export async function runDueReminders() {
  const db = getDb();
  const due = db
    .prepare(
      `SELECT r.*, m.brand_name, m.generic_name, m.strength, u.id AS user_id
         FROM refill_reminders r
         JOIN medicines m ON m.id = r.medicine_id
         JOIN users u ON u.id = r.user_id AND u.is_active = 1
        WHERE r.is_active = 1 AND datetime(r.next_due_at) <= datetime('now')`
    )
    .all();
  for (const reminder of due) {
    await notifyUser(
      reminder.user_id,
      'refill_reminder',
      `Refill reminder: it may be time to restock ${reminder.brand_name}${reminder.strength ? ` ${reminder.strength}` : ''}. Order from a pharmacy near you on PharmaLink.`
    );
    db.prepare(
      `UPDATE refill_reminders SET next_due_at = datetime(next_due_at, '+' || interval_days || ' days')
        WHERE id = ?`
    ).run(reminder.id);
  }
  return due.length;
}
