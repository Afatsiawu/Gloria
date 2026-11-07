import { getDb } from '../db/index.js';

export function list(pharmacyId, includeInactive = false) {
  const where = includeInactive ? 'WHERE s.pharmacy_id = ?' : 'WHERE s.pharmacy_id = ? AND s.is_active = 1';
  return getDb()
    .prepare(
      `SELECT s.*, (SELECT COUNT(*) FROM batches b WHERE b.supplier_id = s.id) AS batch_count
         FROM suppliers s ${where} ORDER BY s.name`
    )
    .all(pharmacyId);
}

export function get(id) {
  return getDb().prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
}

export function create(data) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO suppliers (pharmacy_id, name, contact_person, phone, email, address)
       VALUES (@pharmacyId, @name, @contactPerson, @phone, @email, @address)`
    )
    .run(data);
  return get(info.lastInsertRowid);
}

export function update(id, data) {
  getDb()
    .prepare(
      `UPDATE suppliers SET name = @name, contact_person = @contactPerson, phone = @phone,
        email = @email, address = @address, is_active = @isActive WHERE id = @id`
    )
    .run({ id, ...data });
  return get(id);
}

export function deactivate(id) {
  getDb().prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?').run(id);
}
