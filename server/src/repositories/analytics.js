import { getDb } from '../db/index.js';

function scope(pharmacyId) {
  return pharmacyId ? 'AND o.pharmacy_id = @pharmacyId' : '';
}

export function summary({ from, to, pharmacyId }) {
  const db = getDb();
  const params = { from, to, ...(pharmacyId ? { pharmacyId } : {}) };
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(o.total), 0) AS revenue,
              COALESCE(SUM(o.subtotal), 0) AS product_revenue,
              COALESCE(AVG(o.total), 0) AS average_order
         FROM orders o
        WHERE o.status != 'cancelled' AND o.payment_status IN ('success', 'cash_on_pickup')
          AND date(o.created_at) BETWEEN date(@from) AND date(@to) ${scope(pharmacyId)}`
    )
    .get(params);
  const units = db
    .prepare(
      `SELECT COALESCE(SUM(oi.quantity), 0) AS units FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN date(@from) AND date(@to) ${scope(pharmacyId)}`
    )
    .get(params).units;
  const trend = db
    .prepare(
      `SELECT date(o.created_at) AS date, ROUND(SUM(o.total), 2) AS revenue, COUNT(*) AS orders
         FROM orders o
        WHERE o.status != 'cancelled' AND o.payment_status IN ('success', 'cash_on_pickup')
          AND date(o.created_at) BETWEEN date(@from) AND date(@to) ${scope(pharmacyId)}
        GROUP BY date(o.created_at) ORDER BY date(o.created_at)`
    )
    .all(params);
  const topProducts = db
    .prepare(
      `SELECT oi.medicine_id, m.brand_name, m.generic_name, m.strength,
              SUM(oi.quantity) AS units, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN medicines m ON m.id = oi.medicine_id
        WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN date(@from) AND date(@to) ${scope(pharmacyId)}
        GROUP BY oi.medicine_id ORDER BY units DESC LIMIT 10`
    )
    .all(params);
  const byCommunity = db
    .prepare(
      `SELECT p.community, ROUND(SUM(o.total), 2) AS revenue, COUNT(*) AS orders
         FROM orders o JOIN pharmacies p ON p.id = o.pharmacy_id
        WHERE o.status != 'cancelled' AND o.payment_status IN ('success', 'cash_on_pickup')
          AND date(o.created_at) BETWEEN date(@from) AND date(@to) ${scope(pharmacyId)}
        GROUP BY p.community ORDER BY revenue DESC`
    )
    .all(params);
  const byPharmacy = db
    .prepare(
      `SELECT p.id, p.name, p.community, ROUND(SUM(o.total), 2) AS revenue, COUNT(*) AS orders
         FROM orders o JOIN pharmacies p ON p.id = o.pharmacy_id
        WHERE o.status != 'cancelled' AND o.payment_status IN ('success', 'cash_on_pickup')
          AND date(o.created_at) BETWEEN date(@from) AND date(@to) ${scope(pharmacyId)}
        GROUP BY p.id ORDER BY revenue DESC`
    )
    .all(params);
  const paymentMethods = db
    .prepare(
      `SELECT pay.method, COUNT(*) AS count, ROUND(SUM(pay.amount), 2) AS amount
         FROM payments pay JOIN orders o ON o.id = pay.order_id
        WHERE pay.status = 'success' AND date(o.created_at) BETWEEN date(@from) AND date(@to) ${scope(pharmacyId)}
        GROUP BY pay.method`
    )
    .all(params);
  const statuses = db
    .prepare(
      `SELECT o.status, COUNT(*) AS count FROM orders o
        WHERE date(o.created_at) BETWEEN date(@from) AND date(@to) ${scope(pharmacyId)}
        GROUP BY o.status`
    )
    .all(params);
  const unmet = db
    .prepare(
      `SELECT searched_term, COUNT(*) AS count, community FROM unmet_requests
        WHERE date(created_at) BETWEEN date(@from) AND date(@to)
        GROUP BY searched_term, community ORDER BY count DESC LIMIT 15`
    )
    .all({ from, to });
  const slowMoving = db
    .prepare(
      `SELECT m.id AS medicine_id, m.brand_name, m.generic_name, m.strength,
              COALESCE(SUM(CASE WHEN b.expiry_date >= date('now') AND b.quantity_on_hand > 0
                                THEN b.quantity_on_hand ELSE 0 END), 0) AS stock,
              COALESCE(s.sold, 0) AS sold
         FROM medicines m
         LEFT JOIN batches b ON b.medicine_id = m.id ${pharmacyId ? 'AND b.pharmacy_id = @pharmacyId' : ''}
         LEFT JOIN (
           SELECT oi.medicine_id, SUM(oi.quantity) AS sold
             FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.status != 'cancelled' AND date(o.created_at) BETWEEN date(@from) AND date(@to)
              ${pharmacyId ? 'AND o.pharmacy_id = @pharmacyId' : ''}
            GROUP BY oi.medicine_id
         ) s ON s.medicine_id = m.id
        WHERE m.is_active = 1
        GROUP BY m.id HAVING sold = 0 AND stock > 0
        ORDER BY stock DESC LIMIT 15`
    )
    .all(params);
  return {
    range: { from, to },
    totals: { ...totals, units: units || 0 },
    trend,
    top_products: topProducts,
    by_community: byCommunity,
    by_pharmacy: byPharmacy,
    payment_methods: paymentMethods,
    statuses,
    unmet_demand: unmet,
    slow_moving: slowMoving,
  };
}

export function weekLabels(weeks) {
  const db = getDb();
  const labels = [];
  for (let n = weeks - 1; n >= 0; n -= 1) {
    labels.push(
      db.prepare("SELECT strftime('%Y-%W', date('now', '-' || ? || ' days')) AS week").get(n * 7).week
    );
  }
  return labels;
}

export function forecastData(pharmacyId, weeks) {
  const db = getDb();
  const medicines = db
    .prepare(
      `SELECT m.id AS medicine_id, m.brand_name, m.generic_name, m.strength, m.dosage_form,
              pm.reorder_level, COALESCE((
                SELECT SUM(b.quantity_on_hand) FROM batches b
                 WHERE b.pharmacy_id = @pharmacyId AND b.medicine_id = m.id
                   AND b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
              ), 0) AS on_hand
         FROM pharmacy_medicines pm JOIN medicines m ON m.id = pm.medicine_id
        WHERE pm.pharmacy_id = @pharmacyId AND pm.is_active = 1 AND m.is_active = 1
        ORDER BY m.brand_name`
    )
    .all({ pharmacyId });
  const sales = db
    .prepare(
      `SELECT oi.medicine_id, strftime('%Y-%W', o.created_at) AS week, SUM(oi.quantity) AS quantity
         FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.pharmacy_id = @pharmacyId AND o.status != 'cancelled'
          AND o.created_at >= datetime('now', '-' || (@weeks * 7) || ' days')
        GROUP BY oi.medicine_id, week`
    )
    .all({ pharmacyId, weeks });
  return { medicines, sales, labels: weekLabels(weeks) };
}
