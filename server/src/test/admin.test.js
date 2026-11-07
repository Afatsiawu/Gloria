import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient } from './helpers.js';

const app = createApp();
let ids;
let admin;

beforeEach(async () => {
  resetDb();
  ids = seedBase();
  admin = await makeClient(app);
  await admin.login('+233240000100');
});

describe('user administration', () => {
  it('creates staff, validates assignments and lists users', async () => {
    const created = await admin.post('/api/users', {
      fullName: 'New Rider',
      phone: '020 000 0300',
      role: 'rider',
      pharmacyId: ids.pharmacyA,
      community: 'Doryumu',
      password: 'RiderPass123',
    });
    expect(created.status).toBe(201);
    expect(created.body.user).toMatchObject({
      role: 'rider',
      phone: '+233200000300',
      pharmacy_id: ids.pharmacyA,
    });
    expect(created.body.user.password_hash).toBeUndefined();

    const invalid = await admin.post('/api/users', {
      fullName: 'Rider Without Pharmacy',
      phone: '0200000301',
      role: 'rider',
      password: 'RiderPass123',
    });
    expect(invalid.status).toBe(400);

    const list = await admin.get('/api/users?role=rider');
    expect(list.body.items.length).toBeGreaterThanOrEqual(3);
    expect(list.body.items.every((user) => user.role === 'rider')).toBe(true);
  });

  it('updates a user, suspends and reactivates them', async () => {
    const updated = await admin.patch(`/api/users/${ids.riderA}`, {
      fullName: 'Kwesi Rider Updated',
      phone: '+233240000105',
      role: 'rider',
      pharmacyId: ids.pharmacyA,
      isActive: true,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.user.full_name).toBe('Kwesi Rider Updated');

    const suspended = await admin.post(`/api/users/${ids.riderA}/suspend`);
    expect(suspended.body.user.is_active).toBe(0);
    const activated = await admin.post(`/api/users/${ids.riderA}/activate`);
    expect(activated.body.user.is_active).toBe(1);
  });

  it('prevents an administrator from suspending their own account', async () => {
    const response = await admin.post(`/api/users/${ids.admin}/suspend`);
    expect(response.status).toBe(409);
  });

  it('blocks a pharmacist from the user administration area', async () => {
    const pharmacist = await makeClient(app);
    await pharmacist.login('+233240000103');
    expect((await pharmacist.get('/api/users')).status).toBe(403);
  });
});

describe('settings and audit trail', () => {
  it('reads and updates validated settings', async () => {
    const before = await admin.get('/api/admin/settings');
    expect(before.status).toBe(200);
    expect(before.body.values.expiry_alert_days).toBe(90);

    const updated = await admin.patch('/api/admin/settings', {
      expiry_alert_days: 45,
      forecast_window_weeks: 6,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.values.expiry_alert_days).toBe(45);
    expect(updated.body.values.forecast_window_weeks).toBe(6);

    const invalid = await admin.patch('/api/admin/settings', { expiry_alert_days: 0 });
    expect(invalid.status).toBe(400);
  });

  it('records consequential actions in the audit log', async () => {
    await admin.patch('/api/admin/settings', { safety_stock_days: 5 });
    const audit = await admin.get('/api/admin/audit');
    expect(audit.status).toBe(200);
    expect(audit.body.items.some((row) => row.action === 'settings_updated')).toBe(true);
    expect(audit.body.items.every((row) => row.created_at)).toBe(true);
    expect(audit.body.pagination.total).toBeGreaterThan(0);
  });
});

describe('backups and data requests', () => {
  it('explains that an in-memory database is not backed up and lists no files', async () => {
    const created = await admin.post('/api/admin/backups');
    expect(created.status).toBe(201);
    expect(created.body.backup.file).toBeNull();
    expect(created.body.backup.message).toMatch(/In-memory/);

    const list = await admin.get('/api/admin/backups');
    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([]);
  });

  it('processes a deletion request by anonymising the customer', async () => {
    const customer = await makeClient(app);
    await customer.login('+233240000101');
    const requested = await customer.post('/api/auth/me/delete-request');
    expect(requested.status).toBe(202);

    const pending = await admin.get('/api/admin/data-requests');
    expect(pending.body.items).toHaveLength(1);
    expect(pending.body.items[0].status).toBe('pending');

    const processed = await admin.post(`/api/admin/data-requests/${requested.body.request.id}/process`);
    expect(processed.status).toBe(200);
    expect(processed.body.request.status).toBe('completed');

    const anonymised = getDb().prepare('SELECT * FROM users WHERE id = ?').get(ids.customer);
    expect(anonymised.full_name).toBe('Deleted customer');
    expect(anonymised.phone).toMatch(/^deleted-/);
    expect(anonymised.is_active).toBe(0);
    expect((await customer.get('/api/auth/me')).status).toBe(401);

    const again = await admin.post(`/api/admin/data-requests/${requested.body.request.id}/process`);
    expect(again.status).toBe(409);
  });
});

describe('notifications outbox', () => {
  it('keeps an in-app and mock SMS copy of customer notifications', async () => {
    const customer = await makeClient(app);
    await customer.login('+233240000101');
    await customer.post('/api/cart/items', {
      medicineId: ids.medicineOtc,
      quantity: 1,
      pharmacyId: ids.pharmacyA,
    });
    await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });

    const notifications = await customer.get('/api/auth/me/notifications');
    expect(notifications.status).toBe(200);
    expect(notifications.body.items.some((row) => row.event === 'order_confirmation')).toBe(true);

    const dbChannels = getDb()
      .prepare("SELECT DISTINCT channel FROM notifications WHERE user_id = ? AND event = 'order_confirmation'")
      .all(ids.customer)
      .map((row) => row.channel)
      .sort();
    expect(dbChannels).toEqual(['email', 'in_app', 'sms']);
  });
});
