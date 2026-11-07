import { getDb } from '../db/index.js';

function orderScope({ from, to, pharmacyId, status, channel }) {
  const where = ['date(o.created_at) BETWEEN date(@from) AND date(@to)'];
  const params = { from, to };
  if (pharmacyId) {
    where.push('o.pharmacy_id = @pharmacyId');
    params.pharmacyId = pharmacyId;
  }
  if (status) {
    where.push('o.status = @status');
    params.status = status;
  }
  if (channel) {
    where.push('o.channel = @channel');
    params.channel = channel;
  }
  return { clause: where.join(' AND '), params };
}

export function salesRows(filters) {
  const { clause, params } = orderScope(filters);
  return getDb()
    .prepare(
      `SELECT o.reference, date(o.created_at) AS date, p.name AS pharmacy, p.community,
              COALESCE(u.full_name, 'Walk-in customer') AS customer, o.channel, o.fulfilment,
              o.status, o.payment_status, o.subtotal, o.delivery_fee, o.total
         FROM orders o JOIN pharmacies p ON p.id = o.pharmacy_id
         LEFT JOIN users u ON u.id = o.customer_id
        WHERE ${clause}
        ORDER BY o.created_at ASC, o.id ASC`
    )
    .all(params);
}

export function stockRows({ pharmacyId }) {
  const db = getDb();
  const scope = pharmacyId ? 'AND pm.pharmacy_id = @pharmacyId' : '';
  const params = pharmacyId ? { pharmacyId } : {};
  return db
    .prepare(
      `SELECT p.name AS pharmacy, p.community, m.brand_name, m.generic_name, m.strength,
              pm.price, pm.reorder_level,
              COALESCE(SUM(CASE WHEN b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
                                THEN b.quantity_on_hand ELSE 0 END), 0) AS stock,
              ROUND(COALESCE(SUM(CASE WHEN b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
                                THEN b.quantity_on_hand ELSE 0 END), 0) * pm.price, 2) AS stock_value
         FROM pharmacy_medicines pm
         JOIN pharmacies p ON p.id = pm.pharmacy_id AND p.is_active = 1
         JOIN medicines m ON m.id = pm.medicine_id AND m.is_active = 1
         LEFT JOIN batches b ON b.pharmacy_id = pm.pharmacy_id AND b.medicine_id = pm.medicine_id
        WHERE pm.is_active = 1 ${scope}
        GROUP BY pm.pharmacy_id, pm.medicine_id
        ORDER BY p.name, m.brand_name`
    )
    .all(params);
}

export function expiryRows({ pharmacyId, days = 90 }) {
  const db = getDb();
  const scope = pharmacyId ? 'AND b.pharmacy_id = @pharmacyId' : '';
  const params = { days, ...(pharmacyId ? { pharmacyId } : {}) };
  return db
    .prepare(
      `SELECT p.name AS pharmacy, p.community, m.brand_name, m.generic_name, m.strength,
              b.batch_no, s.name AS supplier, b.expiry_date, b.quantity_on_hand,
              CAST(julianday(b.expiry_date) - julianday(date('now')) AS INTEGER) AS days_left,
              CASE WHEN b.expiry_date < date('now') THEN 'EXPIRED' ELSE 'EXPIRING' END AS state
         FROM batches b JOIN pharmacies p ON p.id = b.pharmacy_id
         JOIN medicines m ON m.id = b.medicine_id
         LEFT JOIN suppliers s ON s.id = b.supplier_id
        WHERE b.quantity_on_hand > 0
          AND b.expiry_date <= date('now', '+' || @days || ' days') ${scope}
        ORDER BY b.expiry_date ASC`
    )
    .all(params);
}

export function ordersRows(filters) {
  const { clause, params } = orderScope(filters);
  return getDb()
    .prepare(
      `SELECT o.reference, date(o.created_at) AS date, p.name AS pharmacy, p.community,
              COALESCE(u.full_name, 'Walk-in customer') AS customer, o.channel, o.fulfilment,
              o.status, o.payment_status, o.total,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS items
         FROM orders o JOIN pharmacies p ON p.id = o.pharmacy_id
         LEFT JOIN users u ON u.id = o.customer_id
        WHERE ${clause}
        ORDER BY o.created_at DESC`
    )
    .all(params);
}

export function ordersForReceipt(orderId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT o.*, p.name AS pharmacy_name, p.address AS pharmacy_address, p.phone AS pharmacy_phone,
              u.full_name AS customer_name, z.name AS zone_name
         FROM orders o JOIN pharmacies p ON p.id = o.pharmacy_id
         LEFT JOIN users u ON u.id = o.customer_id
         LEFT JOIN delivery_zones z ON z.id = o.delivery_zone_id
        WHERE o.id = ?`
    )
    .get(orderId);
}
