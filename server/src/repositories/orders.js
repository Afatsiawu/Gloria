import { getDb } from '../db/index.js';

export function createOrder(data) {
  const info = getDb()
    .prepare(
      `INSERT INTO orders (reference, customer_id, pharmacy_id, channel, fulfilment, delivery_zone_id,
        delivery_fee, delivery_address, digital_address_code, status, payment_status, subtotal, total,
        notes, created_by)
       VALUES (@reference, @customerId, @pharmacyId, @channel, @fulfilment, @deliveryZoneId,
        @deliveryFee, @deliveryAddress, @digitalAddressCode, @status, @paymentStatus, @subtotal, @total,
        @notes, @createdBy)`
    )
    .run(data);
  return info.lastInsertRowid;
}

export function addItem(orderId, item) {
  const info = getDb()
    .prepare(
      `INSERT INTO order_items (order_id, medicine_id, quantity, unit_price, medicine_name_snapshot)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(orderId, item.medicineId, item.quantity, item.unitPrice, item.name);
  return info.lastInsertRowid;
}

export function addAllocation(orderItemId, batchId, quantity) {
  getDb()
    .prepare('INSERT INTO order_item_allocations (order_item_id, batch_id, quantity) VALUES (?, ?, ?)')
    .run(orderItemId, batchId, quantity);
}

export function updateStatus(orderId, status, paymentStatus) {
  const db = getDb();
  if (paymentStatus) {
    db.prepare("UPDATE orders SET status = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(status, paymentStatus, orderId);
  } else {
    db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, orderId);
  }
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

export function setPaymentStatus(orderId, paymentStatus) {
  getDb().prepare("UPDATE orders SET payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(paymentStatus, orderId);
}

export function addEvent(orderId, status, note, createdBy = null) {
  getDb()
    .prepare('INSERT INTO order_events (order_id, status, note, created_by) VALUES (?, ?, ?, ?)')
    .run(orderId, status, note || null, createdBy);
}

export function findRaw(orderId) {
  return getDb().prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

export function findByReference(reference) {
  return getDb().prepare('SELECT * FROM orders WHERE reference = ?').get(reference);
}

export function items(orderId) {
  return getDb()
    .prepare(
      `SELECT oi.*, m.brand_name, m.generic_name, m.strength, m.dosage_form, m.requires_prescription,
              (SELECT COALESCE(SUM(a.quantity), 0) FROM order_item_allocations a WHERE a.order_item_id = oi.id) AS allocated
         FROM order_items oi JOIN medicines m ON m.id = oi.medicine_id
        WHERE oi.order_id = ? ORDER BY oi.id`
    )
    .all(orderId);
}

export function payments(orderId) {
  return getDb().prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC').all(orderId);
}

export function prescriptions(orderId) {
  return getDb()
    .prepare(
      `SELECT p.id, p.order_id, p.status, p.remarks, p.reviewed_at, p.original_name, p.mime_type,
              p.created_at, u.full_name AS reviewed_by_name
         FROM prescriptions p LEFT JOIN users u ON u.id = p.reviewed_by
        WHERE p.order_id = ? ORDER BY p.id DESC`
    )
    .all(orderId);
}

export function delivery(orderId) {
  return getDb()
    .prepare(
      `SELECT d.*, u.full_name AS rider_name, u.phone AS rider_phone
         FROM deliveries d LEFT JOIN users u ON u.id = d.rider_id WHERE d.order_id = ?`
    )
    .get(orderId);
}

export function events(orderId) {
  return getDb()
    .prepare(
      `SELECT e.*, u.full_name AS actor_name FROM order_events e
       LEFT JOIN users u ON u.id = e.created_by WHERE e.order_id = ? ORDER BY e.created_at ASC, e.id ASC`
    )
    .all(orderId);
}

export function canUserAccessOrder(order, user) {
  if (!order || !user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'customer') return order.customer_id === user.id;
  if (user.role === 'pharmacist') return order.pharmacy_id === user.pharmacy_id;
  if (user.role === 'rider') {
    return Boolean(
      getDb().prepare('SELECT 1 FROM deliveries WHERE order_id = ? AND rider_id = ?').get(order.id, user.id)
    );
  }
  return false;
}

export function pendingPrescriptionCount(orderId) {
  return getDb()
    .prepare("SELECT COUNT(*) AS c FROM prescriptions WHERE order_id = ? AND status IN ('pending', 'queried')")
    .get(orderId).c;
}

export function hasPomItems(orderId) {
  return (
    getDb()
      .prepare(
        `SELECT COUNT(*) AS c FROM order_items oi JOIN medicines m ON m.id = oi.medicine_id
          WHERE oi.order_id = ? AND m.requires_prescription = 1`
      )
      .get(orderId).c > 0
  );
}

export function detail(orderId) {
  const db = getDb();
  const order = db
    .prepare(
      `SELECT o.*, p.name AS pharmacy_name, p.community AS pharmacy_community, p.phone AS pharmacy_phone,
              p.address AS pharmacy_address, p.landmark AS pharmacy_landmark,
              u.full_name AS customer_name, u.phone AS customer_phone,
              z.name AS delivery_zone_name,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
         FROM orders o
         JOIN pharmacies p ON p.id = o.pharmacy_id
         LEFT JOIN users u ON u.id = o.customer_id
         LEFT JOIN delivery_zones z ON z.id = o.delivery_zone_id
        WHERE o.id = ?`
    )
    .get(orderId);
  if (!order) return null;
  return {
    ...order,
    items: items(orderId),
    payments: payments(orderId),
    prescriptions: prescriptions(orderId),
    delivery: delivery(orderId) || null,
    events: events(orderId),
  };
}

export function list(query, scope) {
  const db = getDb();
  const where = [];
  const params = {};
  if (scope.customerId) {
    where.push('o.customer_id = @customerId');
    params.customerId = scope.customerId;
  }
  if (scope.pharmacyId) {
    where.push('o.pharmacy_id = @pharmacyId');
    params.pharmacyId = scope.pharmacyId;
  }
  if (scope.riderId) {
    where.push('EXISTS (SELECT 1 FROM deliveries d WHERE d.order_id = o.id AND d.rider_id = @riderId)');
    params.riderId = scope.riderId;
  }
  if (query.status) {
    where.push('o.status = @status');
    params.status = query.status;
  }
  if (query.channel) {
    where.push('o.channel = @channel');
    params.channel = query.channel;
  }
  if (query.from) {
    where.push('date(o.created_at) >= date(@from)');
    params.from = query.from;
  }
  if (query.to) {
    where.push('date(o.created_at) <= date(@to)');
    params.to = query.to;
  }
  if (query.q) {
    where.push('(o.reference LIKE @q OR u.full_name LIKE @q OR u.phone LIKE @q)');
    params.q = `%${query.q}%`;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders o LEFT JOIN users u ON u.id = o.customer_id ${clause}`
    )
    .get(params).c;
  const items = db
    .prepare(
      `SELECT o.*, p.name AS pharmacy_name, p.community AS pharmacy_community,
              u.full_name AS customer_name, u.phone AS customer_phone,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count,
              (SELECT COUNT(*) FROM prescriptions pr WHERE pr.order_id = o.id AND pr.status IN ('pending','queried')) AS pending_prescriptions,
              d.rider_id, r.full_name AS rider_name, d.status AS delivery_status
         FROM orders o
         JOIN pharmacies p ON p.id = o.pharmacy_id
         LEFT JOIN users u ON u.id = o.customer_id
         LEFT JOIN deliveries d ON d.order_id = o.id
         LEFT JOIN users r ON r.id = d.rider_id
         ${clause}
        ORDER BY o.created_at DESC, o.id DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: query.pageSize, offset: query.offset });
  return { items, total };
}

export function allocationsWithBatches(orderId) {
  return getDb()
    .prepare(
      `SELECT a.*, b.batch_no, b.expiry_date, b.pharmacy_id FROM order_item_allocations a
       JOIN batches b ON b.id = a.batch_id
       JOIN order_items oi ON oi.id = a.order_item_id
       WHERE oi.order_id = ?`
    )
    .all(orderId);
}
