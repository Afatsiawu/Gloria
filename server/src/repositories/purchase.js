import { getDb } from '../db/index.js';

export function list(pharmacyId, status) {
  const where = ['po.pharmacy_id = ?'];
  const params = [pharmacyId];
  if (status) {
    where.push('po.status = ?');
    params.push(status);
  }
  return getDb()
    .prepare(
      `SELECT po.*, s.name AS supplier_name, u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM purchase_order_items i WHERE i.purchase_order_id = po.id) AS item_count,
              (SELECT COALESCE(SUM(i.quantity_ordered * i.unit_cost), 0) FROM purchase_order_items i
                WHERE i.purchase_order_id = po.id) AS order_value
         FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id
         LEFT JOIN users u ON u.id = po.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY po.created_at DESC, po.id DESC`
    )
    .all(...params);
}

export function detail(id) {
  const db = getDb();
  const order = db
    .prepare(
      `SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, s.email AS supplier_email,
              u.full_name AS created_by_name,
              (SELECT COALESCE(SUM(i.quantity_ordered * i.unit_cost), 0) FROM purchase_order_items i
                WHERE i.purchase_order_id = po.id) AS order_value
         FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
         LEFT JOIN users u ON u.id = po.created_by WHERE po.id = ?`
    )
    .get(id);
  if (!order) return null;
  order.items = db
    .prepare(
      `SELECT i.*, m.brand_name, m.generic_name, m.strength,
              (i.quantity_ordered - i.quantity_received) AS outstanding
         FROM purchase_order_items i JOIN medicines m ON m.id = i.medicine_id
        WHERE i.purchase_order_id = ? ORDER BY i.id`
    )
    .all(id);
  return order;
}

export function create(data, items) {
  const db = getDb();
  return db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO purchase_orders (pharmacy_id, supplier_id, status, created_by) VALUES (?, ?, 'draft', ?)`
      )
      .run(data.pharmacyId, data.supplierId, data.createdBy);
    const insert = db.prepare(
      `INSERT INTO purchase_order_items (purchase_order_id, medicine_id, quantity_ordered, unit_cost)
       VALUES (?, ?, ?, ?)`
    );
    for (const item of items) {
      insert.run(info.lastInsertRowid, item.medicineId, item.quantityOrdered, item.unitCost || 0);
    }
    return detail(info.lastInsertRowid);
  })();
}

export function updateStatus(id, status) {
  const db = getDb();
  db.prepare("UPDATE purchase_orders SET status = ?, received_at = CASE WHEN ? = 'received' THEN datetime('now') ELSE received_at END WHERE id = ?").run(status, status, id);
  return detail(id);
}

export function receive(id, receipts, user) {
  const db = getDb();
  return db.transaction(() => {
    const order = db.prepare('SELECT * FROM purchase_orders WHERE id = ?').get(id);
    const insertBatch = db.prepare(
      `INSERT INTO batches (pharmacy_id, medicine_id, batch_no, supplier_id, expiry_date,
        quantity_received, quantity_on_hand, purchase_order_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateItem = db.prepare(
      'UPDATE purchase_order_items SET quantity_received = quantity_received + ? WHERE id = ? AND purchase_order_id = ?'
    );
    for (const receipt of receipts) {
      const item = db
        .prepare('SELECT * FROM purchase_order_items WHERE id = ? AND purchase_order_id = ?')
        .get(receipt.purchaseOrderItemId, id);
      if (!item) throw new Error('Purchase order item not found');
      const remaining = item.quantity_ordered - item.quantity_received;
      if (receipt.quantityReceived > remaining) {
        throw new Error('Received quantity exceeds the quantity ordered');
      }
      insertBatch.run(
        order.pharmacy_id,
        item.medicine_id,
        receipt.batchNo,
        order.supplier_id,
        receipt.expiryDate,
        receipt.quantityReceived,
        receipt.quantityReceived,
        id
      );
      updateItem.run(receipt.quantityReceived, item.id, id);
    }
    const outstanding = db
      .prepare(
        `SELECT COUNT(*) AS c FROM purchase_order_items WHERE purchase_order_id = ? AND quantity_received < quantity_ordered`
      )
      .get(id).c;
    if (outstanding === 0) {
      db.prepare("UPDATE purchase_orders SET status = 'received', received_at = datetime('now') WHERE id = ?").run(id);
    }
    db.prepare(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, after_json) VALUES (?, 'goods_received', 'purchase_order', ?, ?)`
    ).run(user.id, id, JSON.stringify({ receipts: receipts.length }));
    return detail(id);
  })();
}
