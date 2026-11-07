import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient } from './helpers.js';
import { runDueReminders } from '../services/refillService.js';

const app = createApp();
let ids;
let customer;

beforeEach(async () => {
  resetDb();
  ids = seedBase();
  customer = await makeClient(app);
  await customer.login('+233240000101');
});

describe('refill reminders', () => {
  it('creates, updates, lists and deletes a reminder', async () => {
    const created = await customer.post('/api/refills', {
      medicineId: ids.medicineOtc,
      intervalDays: 30,
    });
    expect(created.status).toBe(201);
    expect(created.body.reminder).toMatchObject({
      medicine_id: ids.medicineOtc,
      interval_days: 30,
      is_active: 1,
    });
    expect(new Date(created.body.reminder.next_due_at).getTime()).toBeGreaterThan(Date.now());

    const listed = await customer.get('/api/refills');
    expect(listed.body.items).toHaveLength(1);
    expect(listed.body.items[0].brand_name).toBe('Paracetamol');

    const updated = await customer.patch(`/api/refills/${created.body.reminder.id}`, {
      intervalDays: 60,
      isActive: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.reminder.interval_days).toBe(60);
    expect(updated.body.reminder.is_active).toBe(0);

    expect((await customer.del(`/api/refills/${created.body.reminder.id}`)).status).toBe(204);
    expect((await customer.get('/api/refills')).body.items).toHaveLength(0);
  });

  it('upserts instead of duplicating a reminder for the same medicine', async () => {
    await customer.post('/api/refills', { medicineId: ids.medicineOtc, intervalDays: 30 });
    await customer.post('/api/refills', { medicineId: ids.medicineOtc, intervalDays: 45 });
    const rows = getDb().prepare('SELECT * FROM refill_reminders WHERE user_id = ?').all(ids.customer);
    expect(rows).toHaveLength(1);
    expect(rows[0].interval_days).toBe(45);
  });

  it('keeps reminders private to the customer', async () => {
    const created = await customer.post('/api/refills', { medicineId: ids.medicineOtc, intervalDays: 30 });
    const other = await makeClient(app);
    await other.login('+233240000102');
    expect((await other.get('/api/refills')).body.items).toHaveLength(0);
    expect((await other.patch(`/api/refills/${created.body.reminder.id}`, { intervalDays: 10 })).status).toBe(404);
    expect((await other.del(`/api/refills/${created.body.reminder.id}`)).status).toBe(404);
  });

  it('notifies the customer when the scheduled job finds a due reminder', async () => {
    const created = await customer.post('/api/refills', { medicineId: ids.medicinePom, intervalDays: 14 });
    getDb()
      .prepare("UPDATE refill_reminders SET next_due_at = datetime('now', '-1 day') WHERE id = ?")
      .run(created.body.reminder.id);

    const sent = await runDueReminders();
    expect(sent).toBe(1);
    const notification = getDb()
      .prepare("SELECT * FROM notifications WHERE user_id = ? AND event = 'refill_reminder'")
      .get(ids.customer);
    expect(notification).toBeTruthy();
    expect(notification.message).toContain('Amoxil');

    const advanced = getDb().prepare('SELECT * FROM refill_reminders WHERE id = ?').get(created.body.reminder.id);
    expect(new Date(advanced.next_due_at).getTime()).toBeGreaterThan(Date.now());
    expect(await runDueReminders()).toBe(0);
  });

  it('is restricted to customers', async () => {
    const pharmacist = await makeClient(app);
    await pharmacist.login('+233240000103');
    expect((await pharmacist.get('/api/refills')).status).toBe(403);
    const anonymous = await makeClient(app);
    expect((await anonymous.get('/api/refills')).status).toBe(401);
  });
});
