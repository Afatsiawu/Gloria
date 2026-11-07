import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient, stockOf } from './helpers.js';

const app = createApp();
let ids;
let pharmacist;
let admin;

function future(days = 180) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

beforeEach(async () => {
  resetDb();
  ids = seedBase();
  pharmacist = await makeClient(app);
  await pharmacist.login('+233240000103');
  admin = await makeClient(app);
  await admin.login('+233240000100');
});

describe('stock overview and alerts', () => {
  it('shows stock per medicine and filters low-stock rows', async () => {
    const all = await pharmacist.get('/api/inventory');
    expect(all.status).toBe(200);
    const paracetamol = all.body.items.find((row) => row.medicine_id === ids.medicineOtc);
    expect(paracetamol.stock).toBe(30);

    const low = await pharmacist.get('/api/inventory?lowOnly=true');
    expect(low.body.items.map((row) => row.brand_name)).toEqual(['ORS Plus']);
  });

  it('lists batches with expiry state and excludes expired batches from available stock', async () => {
    const response = await pharmacist.get('/api/inventory/batches?medicineId=' + ids.medicineOtc);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(3);
    const states = Object.fromEntries(response.body.items.map((row) => [row.batch_no, row.expiry_state]));
    expect(states['PAR-EXPIRED']).toBe('expired');
    expect(states['PAR-SOON']).toBe('expiring');
    expect(states['PAR-LATER']).toBe('ok');
  });

  it('reports low stock, expiring and expired batches', async () => {
    const response = await pharmacist.get('/api/inventory/alerts?days=30');
    expect(response.status).toBe(200);
    expect(response.body.low_stock.map((row) => row.brand_name)).toContain('ORS Plus');
    expect(response.body.expiring.map((row) => row.batch_no)).toContain('PAR-SOON');
    expect(response.body.expired.map((row) => row.batch_no)).toContain('PAR-EXPIRED');
  });

  it('requires an admin to choose a pharmacy for pharmacy-scoped inventory', async () => {
    expect((await admin.get('/api/inventory')).status).toBe(400);
    const scoped = await admin.get(`/api/inventory?pharmacyId=${ids.pharmacyB}`);
    expect(scoped.status).toBe(200);
    expect(scoped.body.items.find((row) => row.medicine_id === ids.medicineOtc).stock).toBe(7);
  });
});

describe('receiving and adjusting stock', () => {
  it('receives a new batch and rejects duplicates and past expiry dates', async () => {
    const received = await pharmacist.post('/api/inventory/batches', {
      medicineId: ids.medicineNoStock,
      supplierId: ids.supplier,
      batchNo: 'ORS-001',
      expiryDate: future(120),
      quantity: 40,
    });
    expect(received.status).toBe(201);
    expect(received.body.batch.quantity_on_hand).toBe(40);

    const duplicate = await pharmacist.post('/api/inventory/batches', {
      medicineId: ids.medicineNoStock,
      batchNo: 'ORS-001',
      expiryDate: future(120),
      quantity: 5,
    });
    expect(duplicate.status).toBe(409);

    const expired = await pharmacist.post('/api/inventory/batches', {
      medicineId: ids.medicineNoStock,
      batchNo: 'ORS-OLD',
      expiryDate: future(-2),
      quantity: 5,
    });
    expect(expired.status).toBe(400);
  });

  it('adjusts a batch but never allows negative stock', async () => {
    const adjusted = await pharmacist.patch(`/api/inventory/batches/${ids.batches.later}/adjust`, {
      delta: -4,
      reason: 'Damaged during shelving',
    });
    expect(adjusted.status).toBe(200);
    expect(adjusted.body.batch.quantity_on_hand).toBe(6);

    const tooMuch = await pharmacist.patch(`/api/inventory/batches/${ids.batches.later}/adjust`, {
      delta: -100,
      reason: 'Stock count',
    });
    expect(tooMuch.status).toBe(409);
    expect(stockOf(ids.batches.later)).toBe(6);
  });

  it('does not let a pharmacist touch another pharmacy inventory', async () => {
    const response = await pharmacist.post('/api/inventory/batches', {
      pharmacyId: ids.pharmacyB,
      medicineId: ids.medicineNoStock,
      batchNo: 'X-1',
      expiryDate: future(60),
      quantity: 1,
    });
    expect(response.status).toBe(403);
  });
});

describe('suppliers and purchase orders', () => {
  it('creates, updates and deactivates a supplier', async () => {
    const created = await pharmacist.post('/api/suppliers', {
      name: 'Kordibe Distributors',
      contactPerson: 'Ama',
      phone: '+233240000401',
      email: 'orders@distributor.test',
    });
    expect(created.status).toBe(201);
    const supplier = created.body.supplier;

    const updated = await pharmacist.patch(`/api/suppliers/${supplier.id}`, {
      name: 'Kordibe Distributors Ltd',
      isActive: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.supplier.is_active).toBe(0);

    const activeOnly = await pharmacist.get('/api/suppliers');
    expect(activeOnly.body.items.some((row) => row.id === supplier.id)).toBe(false);
    const all = await pharmacist.get('/api/suppliers?includeInactive=true');
    expect(all.body.items.some((row) => row.id === supplier.id)).toBe(true);
  });

  it('runs draft -> ordered -> received and creates a batch', async () => {
    const created = await pharmacist.post('/api/purchase-orders', {
      supplierId: ids.supplier,
      items: [{ medicineId: ids.medicineNoStock, quantityOrdered: 25, unitCost: 1.75 }],
    });
    expect(created.status).toBe(201);
    const po = created.body.purchaseOrder;
    expect(po.status).toBe('draft');
    expect(po.order_value).toBeCloseTo(43.75, 2);

    const receiveDraft = await pharmacist.post(`/api/purchase-orders/${po.id}/receive`, {
      items: [
        {
          purchaseOrderItemId: po.items[0].id,
          quantityReceived: 25,
          batchNo: 'PO-ORS-1',
          expiryDate: future(300),
        },
      ],
    });
    expect(receiveDraft.status).toBe(409);

    const ordered = await pharmacist.patch(`/api/purchase-orders/${po.id}/status`, { status: 'ordered' });
    expect(ordered.status).toBe(200);
    expect(ordered.body.purchaseOrder.status).toBe('ordered');

    const tooMany = await pharmacist.post(`/api/purchase-orders/${po.id}/receive`, {
      items: [
        {
          purchaseOrderItemId: po.items[0].id,
          quantityReceived: 26,
          batchNo: 'PO-ORS-1',
          expiryDate: future(300),
        },
      ],
    });
    expect(tooMany.status).toBe(400);

    const received = await pharmacist.post(`/api/purchase-orders/${po.id}/receive`, {
      items: [
        {
          purchaseOrderItemId: po.items[0].id,
          quantityReceived: 25,
          batchNo: 'PO-ORS-1',
          expiryDate: future(300),
        },
      ],
    });
    expect(received.status).toBe(200);
    expect(received.body.purchaseOrder.status).toBe('received');
    expect(received.body.purchaseOrder.items[0].quantity_received).toBe(25);

    const batch = getDb().prepare("SELECT * FROM batches WHERE batch_no = 'PO-ORS-1'").get();
    expect(batch).toBeTruthy();
    expect(batch.quantity_on_hand).toBe(25);
    expect(batch.purchase_order_id).toBe(po.id);
  });

  it('rejects a purchase order from another pharmacy supplier', async () => {
    const supplierB = getDb()
      .prepare("INSERT INTO suppliers (pharmacy_id, name) VALUES (?, 'B Supplier')")
      .run(ids.pharmacyB).lastInsertRowid;
    const response = await pharmacist.post('/api/purchase-orders', {
      supplierId: Number(supplierB),
      items: [{ medicineId: ids.medicineOtc, quantityOrdered: 5 }],
    });
    expect(response.status).toBe(400);
  });
});
