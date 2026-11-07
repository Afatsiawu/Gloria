import { getDb } from '../db/index.js';
import { conflict } from '../utils/http.js';

export function availableStock(pharmacyId, medicineId) {
  return getDb()
    .prepare(
      `SELECT COALESCE(SUM(quantity_on_hand), 0) AS stock
         FROM batches
        WHERE pharmacy_id = ? AND medicine_id = ? AND quantity_on_hand > 0
          AND expiry_date >= date('now')`
    )
    .get(pharmacyId, medicineId).stock;
}

/** FEFO order: earliest expiry first, expired batches excluded. */
export function fefoBatches(pharmacyId, medicineId) {
  return getDb()
    .prepare(
      `SELECT id, batch_no, expiry_date, quantity_on_hand
         FROM batches
        WHERE pharmacy_id = ? AND medicine_id = ? AND quantity_on_hand > 0
          AND expiry_date >= date('now')
        ORDER BY expiry_date ASC, id ASC`
    )
    .all(pharmacyId, medicineId);
}

/**
 * Allocates `quantity` using FEFO and deducts stock. MUST be called inside a
 * BEGIN IMMEDIATE transaction. The conditional UPDATE plus a changes() check
 * guarantees the last unit cannot be sold twice; the CHECK constraint is the
 * final backstop against negative stock.
 */
export function allocateFefo(pharmacyId, medicineId, quantity) {
  const db = getDb();
  const batches = fefoBatches(pharmacyId, medicineId);
  const total = batches.reduce((sum, b) => sum + b.quantity_on_hand, 0);
  if (total < quantity) {
    throw conflict('Not enough stock available for one of the items.', [
      { pharmacyId, medicineId, requested: quantity, available: total },
    ]);
  }
  const deduct = db.prepare(
    `UPDATE batches SET quantity_on_hand = quantity_on_hand - ?
      WHERE id = ? AND quantity_on_hand >= ?`
  );
  const allocations = [];
  let remaining = quantity;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity_on_hand, remaining);
    const result = deduct.run(take, batch.id, take);
    if (result.changes !== 1) {
      throw conflict('Stock changed while your request was being processed. Please review your cart and retry.');
    }
    allocations.push({ batchId: batch.id, quantity: take, expiryDate: batch.expiry_date });
    remaining -= take;
  }
  if (remaining > 0) {
    throw conflict('Not enough stock available for one of the items.', [
      { pharmacyId, medicineId, requested: quantity, available: total },
    ]);
  }
  return allocations;
}

/** Restores stock recorded in order_item_allocations (cancellation/refund). */
export function restoreOrderStock(orderId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.batch_id, a.quantity, oi.id AS order_item_id
         FROM order_item_allocations a
         JOIN order_items oi ON oi.id = a.order_item_id
        WHERE oi.order_id = ?`
    )
    .all(orderId);
  const restore = db.prepare('UPDATE batches SET quantity_on_hand = quantity_on_hand + ? WHERE id = ?');
  for (const row of rows) restore.run(row.quantity, row.batch_id);
  return rows;
}

export function stockOverview(pharmacyId, { q, lowOnly, pageSize, offset }) {
  const db = getDb();
  const where = ['pm.pharmacy_id = @pharmacyId', 'pm.is_active = 1', 'm.is_active = 1'];
  const params = { pharmacyId };
  if (q) {
    where.push('(m.brand_name LIKE @q OR m.generic_name LIKE @q)');
    params.q = `%${q}%`;
  }
  const clause = `WHERE ${where.join(' AND ')}`;
  const having = lowOnly ? 'HAVING stock <= pm.reorder_level' : '';
  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT m.id, COALESCE(SUM(CASE WHEN b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
                                       THEN b.quantity_on_hand ELSE 0 END), 0) AS stock
           FROM pharmacy_medicines pm JOIN medicines m ON m.id = pm.medicine_id
           LEFT JOIN batches b ON b.pharmacy_id = pm.pharmacy_id AND b.medicine_id = pm.medicine_id
           ${clause} GROUP BY m.id, pm.reorder_level ${having}
       ) x`
    )
    .get(params).c;
  const items = db
    .prepare(
      `SELECT m.id AS medicine_id, m.brand_name, m.generic_name, m.strength, m.dosage_form,
              m.requires_prescription, pm.price, pm.reorder_level, pm.is_active AS pharmacy_active,
              COALESCE(SUM(CASE WHEN b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
                                THEN b.quantity_on_hand ELSE 0 END), 0) AS stock,
              COUNT(DISTINCT CASE WHEN b.quantity_on_hand > 0 AND b.expiry_date >= date('now') THEN b.id END) AS active_batches,
              MIN(CASE WHEN b.quantity_on_hand > 0 AND b.expiry_date >= date('now') THEN b.expiry_date END) AS nearest_expiry
         FROM pharmacy_medicines pm
         JOIN medicines m ON m.id = pm.medicine_id
         LEFT JOIN batches b ON b.pharmacy_id = pm.pharmacy_id AND b.medicine_id = pm.medicine_id
         ${clause}
        GROUP BY m.id, pm.price, pm.reorder_level, pm.is_active
        ${having}
        ORDER BY stock ASC, m.brand_name COLLATE NOCASE LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset });
  return { items, total };
}

export function stockStats(pharmacyId) {
  const db = getDb();
  const scope = pharmacyId ? 'AND pm.pharmacy_id = ?' : '';
  const params = pharmacyId ? [pharmacyId] : [];
  const products = db
    .prepare(
      `SELECT COUNT(*) AS c FROM pharmacy_medicines pm
        JOIN medicines m ON m.id = pm.medicine_id AND m.is_active = 1
       WHERE pm.is_active = 1 ${scope}`
    )
    .get(...params).c;
  const outOfStock = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT m.id FROM pharmacy_medicines pm JOIN medicines m ON m.id = pm.medicine_id
         LEFT JOIN batches b ON b.pharmacy_id = pm.pharmacy_id AND b.medicine_id = pm.medicine_id
              AND b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
         WHERE pm.is_active = 1 AND m.is_active = 1 ${scope}
         GROUP BY m.id HAVING COALESCE(SUM(b.quantity_on_hand), 0) = 0
       ) x`
    )
    .get(...params).c;
  const low = db
    .prepare(
      `SELECT COUNT(*) AS c FROM (
         SELECT m.id FROM pharmacy_medicines pm JOIN medicines m ON m.id = pm.medicine_id
         LEFT JOIN batches b ON b.pharmacy_id = pm.pharmacy_id AND b.medicine_id = pm.medicine_id
              AND b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
         WHERE pm.is_active = 1 AND m.is_active = 1 ${scope}
         GROUP BY m.id, pm.reorder_level HAVING COALESCE(SUM(b.quantity_on_hand), 0) <= pm.reorder_level
       ) x`
    )
    .get(...params).c;
  const expiryScope = pharmacyId ? 'AND b.pharmacy_id = ?' : '';
  const expiring = db
    .prepare(
      `SELECT COUNT(*) AS c FROM batches b WHERE b.quantity_on_hand > 0
        AND b.expiry_date >= date('now') AND b.expiry_date <= date('now', '+90 days') ${expiryScope}`
    )
    .get(...params).c;
  const expired = db
    .prepare(
      `SELECT COUNT(*) AS c FROM batches b WHERE b.quantity_on_hand > 0 AND b.expiry_date < date('now') ${expiryScope}`
    )
    .get(...params).c;
  return { products, out_of_stock: outOfStock, low_stock: low, expiring_batches: expiring, expired_batches: expired };
}

export function lowStock(pharmacyId) {
  return getDb()
    .prepare(
      `SELECT m.id AS medicine_id, m.brand_name, m.generic_name, m.strength, pm.reorder_level,
              COALESCE(SUM(b.quantity_on_hand), 0) AS stock
         FROM pharmacy_medicines pm
         JOIN medicines m ON m.id = pm.medicine_id
         LEFT JOIN batches b ON b.pharmacy_id = pm.pharmacy_id AND b.medicine_id = pm.medicine_id
              AND b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
        WHERE pm.pharmacy_id = ? AND pm.is_active = 1 AND m.is_active = 1
        GROUP BY m.id, pm.reorder_level
       HAVING stock <= pm.reorder_level
        ORDER BY stock ASC, m.brand_name`
    )
    .all(pharmacyId);
}

export function expiryAlerts(pharmacyId, days) {
  const db = getDb();
  const expiring = db
    .prepare(
      `SELECT b.*, m.brand_name, m.generic_name, m.strength,
              CAST(julianday(b.expiry_date) - julianday(date('now')) AS INTEGER) AS days_left
         FROM batches b JOIN medicines m ON m.id = b.medicine_id
        WHERE b.pharmacy_id = ? AND b.quantity_on_hand > 0
          AND b.expiry_date >= date('now')
          AND b.expiry_date <= date('now', '+' || ? || ' days')
        ORDER BY b.expiry_date ASC`
    )
    .all(pharmacyId, days);
  const expired = db
    .prepare(
      `SELECT b.*, m.brand_name, m.generic_name, m.strength,
              CAST(julianday(b.expiry_date) - julianday(date('now')) AS INTEGER) AS days_left
         FROM batches b JOIN medicines m ON m.id = b.medicine_id
        WHERE b.pharmacy_id = ? AND b.quantity_on_hand > 0 AND b.expiry_date < date('now')
        ORDER BY b.expiry_date ASC`
    )
    .all(pharmacyId);
  return { expiring, expired };
}

export function batchList(pharmacyId, { medicineId, q, pageSize, offset, includeEmpty = false }) {
  const db = getDb();
  const where = ['b.pharmacy_id = @pharmacyId'];
  const params = { pharmacyId };
  if (medicineId) {
    where.push('b.medicine_id = @medicineId');
    params.medicineId = Number(medicineId);
  }
  if (!includeEmpty) where.push('b.quantity_on_hand > 0');
  if (q) {
    where.push('(m.brand_name LIKE @q OR m.generic_name LIKE @q OR b.batch_no LIKE @q)');
    params.q = `%${q}%`;
  }
  const clause = `WHERE ${where.join(' AND ')}`;
  const total = db
    .prepare(`SELECT COUNT(*) AS c FROM batches b JOIN medicines m ON m.id = b.medicine_id ${clause}`)
    .get(params).c;
  const items = db
    .prepare(
      `SELECT b.*, m.brand_name, m.generic_name, m.strength, m.dosage_form,
              s.name AS supplier_name,
              CAST(julianday(b.expiry_date) - julianday(date('now')) AS INTEGER) AS days_left,
              CASE WHEN b.expiry_date < date('now') THEN 'expired'
                   WHEN b.expiry_date <= date('now', '+90 days') THEN 'expiring'
                   ELSE 'ok' END AS expiry_state
         FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         LEFT JOIN suppliers s ON s.id = b.supplier_id
         ${clause}
        ORDER BY b.expiry_date ASC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset });
  return { items, total };
}

export function adjustBatch(batchId, delta, reason, userId) {
  const db = getDb();
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) return null;
  const next = batch.quantity_on_hand + delta;
  if (next < 0) {
    throw conflict('The adjustment would make stock negative.');
  }
  db.transaction(() => {
    db.prepare('UPDATE batches SET quantity_on_hand = ? WHERE id = ?').run(next, batchId);
    db.prepare('INSERT INTO stock_adjustments (batch_id, delta, reason, user_id) VALUES (?, ?, ?, ?)').run(
      batchId,
      delta,
      reason,
      userId
    );
  })();
  return { before: batch, after: db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) };
}

export function receiveBatch(data) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO batches (pharmacy_id, medicine_id, batch_no, supplier_id, expiry_date,
        quantity_received, quantity_on_hand, purchase_order_id)
       VALUES (@pharmacyId, @medicineId, @batchNo, @supplierId, @expiryDate,
        @quantity, @quantity, @purchaseOrderId)`
    )
    .run(data);
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(info.lastInsertRowid);
}
