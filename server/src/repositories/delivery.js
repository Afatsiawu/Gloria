import { getDb } from '../db/index.js';

export function listZones(pharmacyId, includeInactive = false) {
  const where = includeInactive ? 'WHERE pharmacy_id = ?' : 'WHERE pharmacy_id = ? AND is_active = 1';
  return getDb().prepare(`SELECT * FROM delivery_zones ${where} ORDER BY fee, name`).all(pharmacyId);
}

export function getZone(id) {
  return getDb().prepare('SELECT * FROM delivery_zones WHERE id = ?').get(id);
}

export function createZone(data) {
  const db = getDb();
  const info = db
    .prepare('INSERT INTO delivery_zones (pharmacy_id, name, fee, rules) VALUES (?, ?, ?, ?)')
    .run(data.pharmacyId, data.name, data.fee, data.rules || null);
  return getZone(info.lastInsertRowid);
}

export function updateZone(id, data) {
  getDb()
    .prepare(
      "UPDATE delivery_zones SET name = ?, fee = ?, rules = ?, is_active = ? WHERE id = ?"
    )
    .run(data.name, data.fee, data.rules || null, data.isActive === false ? 0 : 1, id);
  return getZone(id);
}

export function deleteZone(id) {
  return getDb().prepare('DELETE FROM delivery_zones WHERE id = ?').run(id);
}

export function createDelivery(orderId, riderId = null) {
  getDb()
    .prepare('INSERT INTO deliveries (order_id, rider_id, status) VALUES (?, ?, ?)')
    .run(orderId, riderId, riderId ? 'assigned' : 'assigned');
}

export function getDelivery(orderId) {
  return getDb()
    .prepare(
      `SELECT d.*, u.full_name AS rider_name, u.phone AS rider_phone FROM deliveries d
       LEFT JOIN users u ON u.id = d.rider_id WHERE d.order_id = ?`
    )
    .get(orderId);
}

export function assignRider(orderId, riderId) {
  getDb()
    .prepare("UPDATE deliveries SET rider_id = ?, status = 'assigned', updated_at = datetime('now') WHERE order_id = ?")
    .run(riderId, orderId);
  return getDelivery(orderId);
}

export function updateDeliveryStatus(orderId, status, notes = null) {
  getDb()
    .prepare("UPDATE deliveries SET status = ?, notes = COALESCE(?, notes), updated_at = datetime('now') WHERE order_id = ?")
    .run(status, notes, orderId);
  return getDelivery(orderId);
}

export function riderDeliveries(riderId, status) {
  const db = getDb();
  const where = ['d.rider_id = @riderId'];
  if (status) where.push('d.status = @status');
  else where.push("d.status IN ('assigned', 'picked_up', 'out_for_delivery')");
  return db
    .prepare(
      `SELECT d.*, o.reference, o.status AS order_status, o.fulfilment, o.delivery_fee,
              o.delivery_address, o.digital_address_code, o.total, o.customer_id,
              p.name AS pharmacy_name, p.phone AS pharmacy_phone, p.landmark AS pharmacy_landmark,
              u.full_name AS customer_name, u.phone AS customer_phone,
              o.guest_name, o.guest_phone,
              z.name AS zone_name
         FROM deliveries d
         JOIN orders o ON o.id = d.order_id
         JOIN pharmacies p ON p.id = o.pharmacy_id
         LEFT JOIN users u ON u.id = o.customer_id
         LEFT JOIN delivery_zones z ON z.id = o.delivery_zone_id
        WHERE ${where.join(' AND ')}
        ORDER BY o.created_at DESC`
    )
    .all({ riderId, status })
    .map((row) => ({
      ...row,
      customer_name: row.customer_name || row.guest_name || null,
      customer_phone: row.customer_phone || row.guest_phone || null,
    }));
}

export function riders(pharmacyId) {
  return getDb()
    .prepare(
      `SELECT id, full_name, phone, email FROM users
        WHERE role = 'rider' AND is_active = 1 AND pharmacy_id = ? ORDER BY full_name`
    )
    .all(pharmacyId);
}

export function deliveryQueue(pharmacyId) {
  return getDb()
    .prepare(
      `SELECT d.*, o.reference, o.status AS order_status, o.delivery_address, o.digital_address_code,
              o.total, o.customer_id, u.full_name AS customer_name, u.phone AS customer_phone,
              o.guest_name, o.guest_phone,
              z.name AS zone_name, r.full_name AS rider_name
         FROM deliveries d
         JOIN orders o ON o.id = d.order_id
         LEFT JOIN users u ON u.id = o.customer_id
         LEFT JOIN users r ON r.id = d.rider_id
         LEFT JOIN delivery_zones z ON z.id = o.delivery_zone_id
        WHERE o.pharmacy_id = ? ORDER BY o.created_at DESC LIMIT 200`
    )
    .all(pharmacyId)
    .map((row) => ({
      ...row,
      customer_name: row.customer_name || row.guest_name || null,
      customer_phone: row.customer_phone || row.guest_phone || null,
    }));
}
