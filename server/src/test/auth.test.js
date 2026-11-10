import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { resetDb, seedBase, TEST_PASSWORD } from './fixtures.js';
import { makeClient } from './helpers.js';

const app = createApp();
let ids;

beforeEach(() => {
  resetDb();
  ids = seedBase();
});

describe('health and CSRF', () => {
  it('exposes a health endpoint backed by the database', async () => {
    const client = await makeClient(app);
    const response = await client.get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'pharmalink-api', database: 'ok' });
  });

  it('sets a readable CSRF cookie and rejects mutations without a matching header', async () => {
    const client = await makeClient(app);
    const csrfResponse = await client.get('/api/auth/csrf');
    expect(csrfResponse.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    expect(csrfResponse.headers['set-cookie'].join(';')).toContain('csrf_token=');

    const blocked = await client.agent.post('/api/auth/login').send({
      identifier: '+233240000101',
      password: TEST_PASSWORD,
    });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('FORBIDDEN');

    const wrong = await client.agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', 'f'.repeat(64))
      .send({ identifier: '+233240000101', password: TEST_PASSWORD });
    expect(wrong.status).toBe(403);
  });
});

describe('authentication', () => {
  it('logs in with a local-format phone number and sets an httpOnly cookie', async () => {
    const client = await makeClient(app);
    const response = await client.login('024 000 0101');
    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: ids.customer,
      role: 'customer',
      phone: '+233240000101',
    });
    expect(response.body.user.password_hash).toBeUndefined();

    const cookie = response.headers['set-cookie'].find((value) => value.startsWith('pharm_token='));
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('customer');
  });

  it('logs in with an email address case-insensitively', async () => {
    const client = await makeClient(app);
    const response = await client.login('ADMIN@TEST.LOCAL');
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('admin');
  });

  it('rejects a wrong password and an unknown account with the same 401', async () => {
    const client = await makeClient(app);
    const wrong = await client.login('+233240000101', 'WrongPass123');
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.message).toMatch(/incorrect/i);

    const unknown = await client.login('+233240000999', TEST_PASSWORD);
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('requires authentication for protected endpoints', async () => {
    const client = await makeClient(app);
    const response = await client.get('/api/orders');
    expect(response.status).toBe(401);
  });

  it('returns 403 when a role is not allowed', async () => {
    const customer = await makeClient(app);
    await customer.login('+233240000101');
    const adminArea = await customer.get('/api/admin/settings');
    expect(adminArea.status).toBe(403);

    const pharmacist = await makeClient(app);
    await pharmacist.login('+233240000103');
    expect((await pharmacist.get('/api/admin/settings')).status).toBe(403);
    expect((await pharmacist.get('/api/analytics/summary')).status).toBe(200);
  });

  it('blocks a suspended account from signing in', async () => {
    const admin = await makeClient(app);
    await admin.login('+233240000100');
    const suspended = await admin.post(`/api/users/${ids.customer}/suspend`);
    expect(suspended.status).toBe(200);
    expect(suspended.body.user.is_active).toBe(0);

    const customer = await makeClient(app);
    const response = await customer.login('+233240000101');
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('This account is suspended. Contact the pharmacy.');
  });
});

describe('user shape for routing', () => {
  const ROUTING_FIELDS = ['id', 'fullName', 'role', 'pharmacyId', 'pharmacyName', 'mustChangePassword'];

  it('returns the same routing shape from login, register and me', async () => {
    const client = await makeClient(app);
    const login = await client.login('+233240000103');
    expect(login.status).toBe(200);
    for (const field of ROUTING_FIELDS) expect(login.body.user).toHaveProperty(field);
    expect(login.body.user).toMatchObject({
      fullName: 'Yaw Pharmacist',
      role: 'pharmacist',
      pharmacyId: ids.pharmacyA,
      pharmacyName: 'Doryumu Community Pharmacy',
      mustChangePassword: false,
    });
    expect(login.body.user.password_hash).toBeUndefined();

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    for (const field of ROUTING_FIELDS) expect(me.body.user).toHaveProperty(field);
    expect(me.body.user).toMatchObject({ id: ids.pharmacistA, role: 'pharmacist', mustChangePassword: false });

    const anonymous = await makeClient(app);
    const registered = await anonymous.post('/api/auth/register', {
      fullName: 'Routing Shape',
      phone: '0200000299',
      password: 'NewPass123',
      community: 'Doryumu',
      consent: true,
    });
    expect(registered.status).toBe(201);
    expect(registered.body.user).toMatchObject({
      role: 'customer',
      pharmacyId: null,
      pharmacyName: null,
      mustChangePassword: false,
    });
    expect(registered.body.user.password_hash).toBeUndefined();
  });

  it('ignores a role sent to the public registration endpoint', async () => {
    const client = await makeClient(app);
    const response = await client.post('/api/auth/register', {
      fullName: 'Sneaky Admin',
      phone: '0200000298',
      password: 'NewPass123',
      community: 'Kordibe',
      consent: true,
      role: 'admin',
    });
    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('customer');
    expect(getDb().prepare('SELECT role FROM users WHERE id = ?').get(response.body.user.id).role).toBe('customer');
  });

  it('lets an admin force a password change and clears the flag after it', async () => {
    const admin = await makeClient(app);
    await admin.login('+233240000100');
    const created = await admin.post('/api/users', {
      fullName: 'New Pharmacist',
      phone: '0200000297',
      role: 'pharmacist',
      pharmacyId: ids.pharmacyA,
      community: 'Doryumu',
      password: 'TempPass123',
      mustChangePassword: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.user.must_change_password).toBe(1);

    const staff = await makeClient(app);
    const login = await staff.login('0200000297', 'TempPass123');
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    expect((await staff.get('/api/auth/me')).body.user.mustChangePassword).toBe(true);

    const changed = await staff.patch('/api/auth/me/password', {
      currentPassword: 'TempPass123',
      newPassword: 'ChosenPass123',
    });
    expect(changed.status).toBe(200);
    expect((await staff.get('/api/auth/me')).body.user.mustChangePassword).toBe(false);
  });

  it('clears the auth cookie on logout', async () => {
    const client = await makeClient(app);
    await client.login('+233240000101');
    const response = await client.post('/api/auth/logout');
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'].join(';')).toMatch(/pharm_token=;/);
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });
});

describe('registration', () => {
  it('creates a customer with a normalised phone and a cart', async () => {
    const client = await makeClient(app);
    const response = await client.post('/api/auth/register', {
      fullName: 'New Customer',
      phone: '020 000 0200',
      email: 'new@test.local',
      password: 'NewPass123',
      community: 'Doryumu',
      consent: true,
    });
    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      role: 'customer',
      phone: '+233200000200',
      community: 'Doryumu',
    });
    expect(response.body.user.password_hash).toBeUndefined();
    expect(getDb().prepare('SELECT consent_at FROM users WHERE id = ?').get(response.body.user.id).consent_at).toBeTruthy();
    const cart = getDb().prepare('SELECT * FROM carts WHERE customer_id = ?').get(response.body.user.id);
    expect(cart).toBeTruthy();

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
  });

  it('rejects a duplicate phone number', async () => {
    const client = await makeClient(app);
    const response = await client.post('/api/auth/register', {
      fullName: 'Duplicate',
      phone: '+233240000101',
      password: 'NewPass123',
      community: 'Kordibe',
      consent: true,
    });
    expect(response.status).toBe(409);
  });

  it('requires consent and a strong password', async () => {
    const client = await makeClient(app);
    const noConsent = await client.post('/api/auth/register', {
      fullName: 'No Consent',
      phone: '0200000201',
      password: 'NewPass123',
      community: 'Kordibe',
    });
    expect(noConsent.status).toBe(400);
    expect(noConsent.body.error.details.some((d) => d.path === 'consent')).toBe(true);

    const weak = await client.post('/api/auth/register', {
      fullName: 'Weak Password',
      phone: '0200000202',
      password: 'weakpass',
      community: 'Kordibe',
      consent: true,
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.message).toMatch(/Password must contain/);
  });

  it('validates the Ghana Post GPS digital address when supplied', async () => {
    const client = await makeClient(app);
    const response = await client.post('/api/auth/register', {
      fullName: 'Bad Address',
      phone: '0200000203',
      password: 'NewPass123',
      community: 'Doryumu',
      digitalAddressCode: '12345',
      consent: true,
    });
    expect(response.status).toBe(400);
    expect(response.body.error.details.some((d) => d.path === 'digitalAddressCode')).toBe(true);
  });
});

describe('password reset', () => {
  it('issues a one-time code and resets the password', async () => {
    const client = await makeClient(app);
    const forgot = await client.post('/api/auth/forgot-password', {
      identifier: '+233240000101',
      channel: 'sms',
    });
    expect(forgot.status).toBe(200);
    expect(forgot.body.dev_code).toMatch(/^\d{6}$/);

    const reset = await client.post('/api/auth/reset-password', {
      identifier: '+233240000101',
      code: forgot.body.dev_code,
      password: 'ResetPass123',
    });
    expect(reset.status).toBe(200);

    const oldPassword = await client.login('+233240000101', TEST_PASSWORD);
    expect(oldPassword.status).toBe(401);
    const newPassword = await client.login('+233240000101', 'ResetPass123');
    expect(newPassword.status).toBe(200);

    const reuse = await client.post('/api/auth/reset-password', {
      identifier: '+233240000101',
      code: forgot.body.dev_code,
      password: 'AnotherPass123',
    });
    expect(reuse.status).toBe(400);
  });

  it('does not reveal whether an account exists', async () => {
    const client = await makeClient(app);
    const response = await client.post('/api/auth/forgot-password', { identifier: '+233240000999' });
    expect(response.status).toBe(200);
    expect(response.body.dev_code).toBeUndefined();
    expect(response.body.message).toMatch(/If an account matches/);
  });
});

describe('verified order linking', () => {
  it('links past guest orders only after a one-time code is verified', async () => {
    getDb()
      .prepare(
        `INSERT INTO orders (reference, customer_id, guest_name, guest_phone, pharmacy_id, channel,
          fulfilment, status, payment_status, subtotal, total, consent_given_at)
         VALUES ('PH-LINK-1', NULL, 'Kofi Guest', '+233240000101', ?, 'online', 'pickup', 'placed',
                 'pending', 5, 5, datetime('now'))`
      )
      .run(ids.pharmacyA);

    const client = await makeClient(app);
    await client.login('+233240000101');
    expect((await client.get('/api/orders')).body.items).toHaveLength(0);

    const requested = await client.post('/api/auth/me/link-orders/request');
    expect(requested.status).toBe(200);
    expect(requested.body.eligible).toBe(true);
    expect(requested.body.dev_code).toMatch(/^\d{6}$/);

    const wrong = await client.post('/api/auth/me/link-orders/verify', { code: '000000' });
    expect(wrong.status).toBe(400);
    expect((await client.get('/api/orders')).body.items).toHaveLength(0);

    const verified = await client.post('/api/auth/me/link-orders/verify', { code: requested.body.dev_code });
    expect(verified.status).toBe(200);
    expect(verified.body.linked).toBe(1);
    const orders = (await client.get('/api/orders')).body.items;
    expect(orders.map((order) => order.reference)).toContain('PH-LINK-1');

    const again = await client.post('/api/auth/me/link-orders/request');
    expect(again.body.eligible).toBe(false);
  });
});

describe('data protection rights', () => {
  it('exports the customer data and records a deletion request once', async () => {
    const client = await makeClient(app);
    await client.login('+233240000101');

    const exported = await client.get('/api/auth/me/data');
    expect(exported.status).toBe(200);
    expect(exported.body.profile.phone).toBe('+233240000101');
    expect(Array.isArray(exported.body.orders)).toBe(true);
    expect(exported.headers['content-disposition']).toContain('attachment');

    const first = await client.post('/api/auth/me/delete-request');
    expect(first.status).toBe(202);
    expect(first.body.request.status).toBe('pending');
    const second = await client.post('/api/auth/me/delete-request');
    expect(second.status).toBe(202);
    expect(second.body.request.id).toBe(first.body.request.id);
  });
});
