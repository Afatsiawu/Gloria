import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient } from './helpers.js';

const app = createApp();
let ids;

beforeEach(() => {
  resetDb();
  ids = seedBase();
});

function insertOrder({ reference, customerId, pharmacyId }) {
  const info = getDb()
    .prepare(
      `INSERT INTO orders (reference, customer_id, pharmacy_id, channel, fulfilment, status,
        payment_status, subtotal, total)
       VALUES (?, ?, ?, 'online', 'pickup', 'placed', 'pending', 5, 5)`
    )
    .run(reference, customerId, pharmacyId);
  return Number(info.lastInsertRowid);
}

describe('role-based API access', () => {
  it('keeps customers out of staff areas', async () => {
    const customer = await makeClient(app);
    await customer.login('+233240000101');

    expect((await customer.get('/api/dashboard')).status).toBe(403);
    expect((await customer.get('/api/inventory')).status).toBe(403);
    expect((await customer.get('/api/prescriptions')).status).toBe(403);
    expect((await customer.get('/api/admin/settings')).status).toBe(403);
    expect((await customer.post('/api/orders/walk-in', { items: [{ medicineId: ids.medicineOtc, quantity: 1 }] })).status).toBe(403);
  });

  it('keeps riders out of pharmacist areas but allows their deliveries', async () => {
    const rider = await makeClient(app);
    await rider.login('+233240000105');

    expect((await rider.get('/api/dashboard')).status).toBe(403);
    expect((await rider.get('/api/inventory')).status).toBe(403);
    expect((await rider.get('/api/prescriptions')).status).toBe(403);
    expect((await rider.get('/api/delivery-zones')).status).toBe(403);
    expect((await rider.get('/api/rider/deliveries')).status).toBe(200);
  });

  it('keeps pharmacists inside their own pharmacy', async () => {
    const orderA = insertOrder({ reference: 'PH-ROLE-A', customerId: ids.customer, pharmacyId: ids.pharmacyA });
    const orderB = insertOrder({ reference: 'PH-ROLE-B', customerId: ids.customerB, pharmacyId: ids.pharmacyB });
    const prescriptionA = Number(
      getDb()
        .prepare(
          `INSERT INTO prescriptions (order_id, customer_id, file_path, mime_type)
           VALUES (?, ?, 'role-test.png', 'image/png')`
        )
        .run(orderA, ids.customer).lastInsertRowid
    );

    const pharmacistB = await makeClient(app);
    await pharmacistB.login('+233240000104');

    expect((await pharmacistB.get(`/api/orders/${orderA}`)).status).toBe(403);
    expect((await pharmacistB.get(`/api/orders/${orderB}`)).status).toBe(200);
    expect((await pharmacistB.patch(`/api/inventory/batches/${ids.batches.soon}/adjust`, { delta: 1, reason: 'test' })).status).toBe(403);
    expect((await pharmacistB.patch(`/api/prescriptions/${prescriptionA}/review`, { status: 'approved' })).status).toBe(403);

    const list = await pharmacistB.get('/api/orders');
    expect(list.status).toBe(200);
    expect(list.body.items.every((order) => order.pharmacy_id === ids.pharmacyB)).toBe(true);

    const pharmacistA = await makeClient(app);
    await pharmacistA.login('+233240000103');
    expect((await pharmacistA.get(`/api/orders/${orderA}`)).status).toBe(200);
    expect((await pharmacistA.patch(`/api/inventory/batches/${ids.batches.soon}/adjust`, { delta: 1, reason: 'test' })).status).toBe(200);
    expect((await pharmacistA.patch(`/api/prescriptions/${prescriptionA}/review`, { status: 'approved' })).status).toBe(200);
  });
});
