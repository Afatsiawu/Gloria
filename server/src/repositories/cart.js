import { getDb } from '../db/index.js';

export function getOrCreateCart(customerId) {
  const db = getDb();
  let cart = db.prepare('SELECT * FROM carts WHERE customer_id = ?').get(customerId);
  if (!cart) {
    const info = db.prepare('INSERT INTO carts (customer_id) VALUES (?)').run(customerId);
    cart = db.prepare('SELECT * FROM carts WHERE id = ?').get(info.lastInsertRowid);
  }
  return cart;
}

export function getCart(customerId) {
  const db = getDb();
  const cart = getOrCreateCart(customerId);
  const pharmacy = cart.pharmacy_id
    ? db.prepare('SELECT id, name, community, phone, address FROM pharmacies WHERE id = ?').get(cart.pharmacy_id)
    : null;
  const items = cart.pharmacy_id
    ? db
        .prepare(
          `SELECT ci.id, ci.medicine_id, ci.quantity,
                  m.brand_name, m.generic_name, m.strength, m.dosage_form,
                  m.requires_prescription, m.image_path, pm.price,
                  COALESCE((SELECT SUM(b.quantity_on_hand) FROM batches b
                             WHERE b.pharmacy_id = @pharmacyId AND b.medicine_id = ci.medicine_id
                               AND b.quantity_on_hand > 0 AND b.expiry_date >= date('now')), 0) AS available,
                  ROUND(ci.quantity * pm.price, 2) AS line_total
             FROM cart_items ci
             JOIN medicines m ON m.id = ci.medicine_id
             JOIN pharmacy_medicines pm ON pm.pharmacy_id = @pharmacyId AND pm.medicine_id = ci.medicine_id
            WHERE ci.cart_id = @cartId
            ORDER BY ci.id`
        )
        .all({ pharmacyId: cart.pharmacy_id, cartId: cart.id })
    : [];
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.line_total, 0) * 100) / 100;
  return {
    id: cart.id,
    pharmacy,
    items,
    item_count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
  };
}

export function setPharmacy(cartId, pharmacyId) {
  getDb().prepare("UPDATE carts SET pharmacy_id = ?, updated_at = datetime('now') WHERE id = ?").run(pharmacyId, cartId);
}

export function upsertItem(cartId, medicineId, quantity) {
  const db = getDb();
  db.prepare(
    `INSERT INTO cart_items (cart_id, medicine_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT (cart_id, medicine_id) DO UPDATE SET quantity = excluded.quantity`
  ).run(cartId, medicineId, quantity);
  db.prepare("UPDATE carts SET updated_at = datetime('now') WHERE id = ?").run(cartId);
  return db.prepare('SELECT * FROM cart_items WHERE cart_id = ? AND medicine_id = ?').get(cartId, medicineId);
}

export function findItem(cartId, itemId) {
  return getDb().prepare('SELECT * FROM cart_items WHERE cart_id = ? AND id = ?').get(cartId, itemId);
}

export function updateItemQuantity(itemId, quantity) {
  return getDb().prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, itemId);
}

export function removeItem(itemId) {
  getDb().prepare('DELETE FROM cart_items WHERE id = ?').run(itemId);
}

export function itemCount(cartId) {
  return getDb().prepare('SELECT COUNT(*) AS c FROM cart_items WHERE cart_id = ?').get(cartId).c;
}

export function clearCart(cartId) {
  const db = getDb();
  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
  db.prepare("UPDATE carts SET pharmacy_id = NULL, updated_at = datetime('now') WHERE id = ?").run(cartId);
}
