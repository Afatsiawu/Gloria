import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, seedBase } from './fixtures.js';
import { allocateFefo, availableStock, fefoBatches, restoreOrderStock, adjustBatch } from '../repositories/inventory.js';
import { getDb } from '../db/index.js';
import { roundMoney } from '../utils/http.js';

let ids;

beforeEach(() => {
  resetDb();
  ids = seedBase();
});

describe('FEFO allocation', () => {
  it('lists only non-expired batches in earliest-expiry order', () => {
    const batches = fefoBatches(ids.pharmacyA, ids.medicineOtc);
    expect(batches.map((batch) => batch.batch_no)).toEqual(['PAR-SOON', 'PAR-LATER']);
    expect(availableStock(ids.pharmacyA, ids.medicineOtc)).toBe(30);
  });

  it('ignores an expired batch even when it holds the most stock', () => {
    expect(availableStock(ids.pharmacyA, ids.medicineOtc)).toBe(30);
    expect(fefoBatches(ids.pharmacyA, ids.medicineOtc).some((b) => b.id === ids.batches.expired)).toBe(false);
  });

  it('takes from the soonest-expiring batch first', () => {
    const allocations = allocateFefo(ids.pharmacyA, ids.medicineOtc, 12);
    expect(allocations).toEqual([{ batchId: ids.batches.soon, quantity: 12, expiryDate: expect.any(String) }]);
    expect(availableStock(ids.pharmacyA, ids.medicineOtc)).toBe(18);
  });

  it('spans multiple batches when the first is exhausted', () => {
    const allocations = allocateFefo(ids.pharmacyA, ids.medicineOtc, 25);
    expect(allocations).toEqual([
      { batchId: ids.batches.soon, quantity: 20, expiryDate: expect.any(String) },
      { batchId: ids.batches.later, quantity: 5, expiryDate: expect.any(String) },
    ]);
    expect(availableStock(ids.pharmacyA, ids.medicineOtc)).toBe(5);
  });

  it('refuses to allocate more than is available without touching stock', () => {
    expect(() => allocateFefo(ids.pharmacyA, ids.medicineOtc, 31)).toThrow(/Not enough stock/);
    expect(availableStock(ids.pharmacyA, ids.medicineOtc)).toBe(30);
  });

  it('restores allocated stock to the same batches', () => {
    const orderId = getDb()
      .prepare(
        `INSERT INTO orders (reference, customer_id, pharmacy_id, fulfilment, status, payment_status,
          subtotal, total, created_by) VALUES ('TEST-001', ?, ?, 'pickup', 'placed', 'cash_on_pickup', 5.5, 5.5, ?)`
      )
      .run(ids.customer, ids.pharmacyA, ids.customer).lastInsertRowid;
    const itemId = getDb()
      .prepare('INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, medicine_name_snapshot) VALUES (?, ?, 25, 5.5, ?)')
      .run(orderId, ids.medicineOtc, 'Paracetamol 500 mg').lastInsertRowid;
    for (const allocation of allocateFefo(ids.pharmacyA, ids.medicineOtc, 25)) {
      getDb()
        .prepare('INSERT INTO order_item_allocations (order_item_id, batch_id, quantity) VALUES (?, ?, ?)')
        .run(itemId, allocation.batchId, allocation.quantity);
    }
    expect(availableStock(ids.pharmacyA, ids.medicineOtc)).toBe(5);

    const restored = restoreOrderStock(orderId);
    expect(restored).toHaveLength(2);
    expect(availableStock(ids.pharmacyA, ids.medicineOtc)).toBe(30);
  });
});

describe('stock safety', () => {
  it('the database CHECK constraint blocks negative stock', () => {
    expect(() => adjustBatch(ids.batches.soon, -21, 'test', ids.admin)).toThrow(/negative/);
    expect(() =>
      getDb().prepare('UPDATE batches SET quantity_on_hand = -1 WHERE id = ?').run(ids.batches.later)
    ).toThrow(/CHECK constraint failed/i);
  });

  it('records an adjustment trail', () => {
    const result = adjustBatch(ids.batches.later, -2, 'Damaged pack', ids.pharmacistA);
    expect(result.before.quantity_on_hand).toBe(10);
    expect(result.after.quantity_on_hand).toBe(8);
    const rows = getDb().prepare('SELECT * FROM stock_adjustments WHERE batch_id = ?').all(ids.batches.later);
    expect(rows).toHaveLength(1);
    expect(rows[0].delta).toBe(-2);
    expect(rows[0].reason).toBe('Damaged pack');
  });

  it('rounds money consistently for totals', () => {
    expect(roundMoney(5.5 * 3 + 5)).toBe(21.5);
    expect(roundMoney(0.1 * 3)).toBe(0.3);
  });
});
