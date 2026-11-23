import { getDb } from '../db/index.js';

const STOCK_JOIN = `
  LEFT JOIN (
    SELECT b.medicine_id, SUM(b.quantity_on_hand) AS stock
      FROM batches b JOIN pharmacies p2 ON p2.id = b.pharmacy_id AND p2.is_active = 1
     WHERE b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
     GROUP BY b.medicine_id
  ) s ON s.medicine_id = m.id
  LEFT JOIN (
    SELECT pm.medicine_id, MIN(pm.price) AS min_price, MAX(pm.price) AS max_price,
           COUNT(DISTINCT pm.pharmacy_id) AS pharmacy_count
      FROM pharmacy_medicines pm JOIN pharmacies p3 ON p3.id = pm.pharmacy_id AND p3.is_active = 1
     WHERE pm.is_active = 1
     GROUP BY pm.medicine_id
  ) pr ON pr.medicine_id = m.id`;

export function searchMedicines({ q, categoryId, available, rx, community, pageSize, offset, includeInactive = false }) {
  const db = getDb();
  const where = [];
  const params = {};
  if (!includeInactive) where.push('m.is_active = 1');
  if (q) {
    where.push('(m.brand_name LIKE @q OR m.generic_name LIKE @q OR m.description LIKE @q)');
    params.q = `%${q}%`;
  }
  if (categoryId) {
    where.push('m.category_id = @categoryId');
    params.categoryId = Number(categoryId);
  }
  if (rx !== undefined) {
    where.push('m.requires_prescription = @rx');
    params.rx = rx ? 1 : 0;
  }
  if (available) where.push('COALESCE(s.stock, 0) > 0');
  if (community) {
    where.push(`EXISTS (
      SELECT 1 FROM pharmacy_medicines pm2
        JOIN pharmacies p4 ON p4.id = pm2.pharmacy_id AND p4.is_active = 1 AND p4.community = @community
        JOIN batches b2 ON b2.pharmacy_id = p4.id AND b2.medicine_id = m.id
       WHERE pm2.medicine_id = m.id AND pm2.is_active = 1
         AND b2.quantity_on_hand > 0 AND b2.expiry_date >= date('now')
    )`);
    params.community = community;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const base = `FROM medicines m LEFT JOIN categories c ON c.id = m.category_id ${STOCK_JOIN} ${clause} GROUP BY m.id`;
  const total = db.prepare(`SELECT COUNT(*) AS c FROM (SELECT m.id ${base}) x`).get(params).c;
  const items = db
    .prepare(
      `SELECT m.id, m.brand_name, m.generic_name, m.strength, m.dosage_form, m.category_id,
              m.requires_prescription, m.description, m.image_path, m.is_active,
              c.name AS category_name,
              COALESCE(s.stock, 0) AS stock,
              COALESCE(pr.min_price, 0) AS min_price,
              COALESCE(pr.max_price, 0) AS max_price,
              COALESCE(pr.pharmacy_count, 0) AS pharmacy_count
         ${base}
        ORDER BY m.brand_name COLLATE NOCASE LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset });
  return { items, total };
}

export function getMedicine(id) {
  return getDb()
    .prepare(
      `SELECT m.*, c.name AS category_name, COALESCE(pr.min_price, 0) AS min_price
       FROM medicines m LEFT JOIN categories c ON c.id = m.category_id ${STOCK_JOIN}
       WHERE m.id = ?`
    )
    .get(id);
}

export function availability(medicineId) {
  return getDb()
    .prepare(
      `SELECT p.id AS pharmacy_id, p.name AS pharmacy_name, p.community, p.address, p.landmark,
              p.phone, pm.price,
              COALESCE(SUM(CASE WHEN b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
                                THEN b.quantity_on_hand ELSE 0 END), 0) AS stock,
              MIN(CASE WHEN b.quantity_on_hand > 0 AND b.expiry_date >= date('now')
                       THEN b.expiry_date END) AS nearest_expiry
         FROM pharmacy_medicines pm
         JOIN pharmacies p ON p.id = pm.pharmacy_id AND p.is_active = 1
         LEFT JOIN batches b ON b.pharmacy_id = p.id AND b.medicine_id = pm.medicine_id
        WHERE pm.medicine_id = ? AND pm.is_active = 1
        GROUP BY p.id, pm.price
        ORDER BY stock DESC, pm.price ASC`
    )
    .all(medicineId);
}

export function listPharmacies(includeInactive = false) {
  const where = includeInactive ? '' : 'WHERE p.is_active = 1';
  return getDb()
    .prepare(`SELECT p.*, (SELECT COUNT(*) FROM users u WHERE u.pharmacy_id = p.id AND u.is_active = 1) AS staff_count
              FROM pharmacies p ${where} ORDER BY p.community, p.name`)
    .all();
}

export function getPharmacy(id) {
  return getDb().prepare('SELECT * FROM pharmacies WHERE id = ?').get(id);
}

export function getPharmacyByName(name) {
  if (!name) return null;
  return getDb().prepare('SELECT * FROM pharmacies WHERE lower(name) = lower(?)').get(String(name).trim());
}

export function listCategories() {
  return getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM medicines m WHERE m.category_id = c.id AND m.is_active = 1) AS medicine_count
       FROM categories c ORDER BY c.name`
    )
    .all();
}

export function createCategory(name, description) {
  const db = getDb();
  const info = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name, description || null);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
}

export function updateCategory(id, name, description) {
  const db = getDb();
  db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?').run(name, description || null, id);
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
}

export function deleteCategory(id) {
  return getDb().prepare('DELETE FROM categories WHERE id = ?').run(id);
}

export function createMedicine(data) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO medicines (brand_name, generic_name, strength, dosage_form, category_id,
        requires_prescription, description, image_path, is_active)
       VALUES (@brandName, @genericName, @strength, @dosageForm, @categoryId,
        @requiresPrescription, @description, @imagePath, @isActive)`
    )
    .run(data);
  return db.prepare('SELECT * FROM medicines WHERE id = ?').get(info.lastInsertRowid);
}

export function updateMedicine(id, data) {
  const db = getDb();
  db.prepare(
    `UPDATE medicines SET brand_name = @brandName, generic_name = @genericName, strength = @strength,
      dosage_form = @dosageForm, category_id = @categoryId, requires_prescription = @requiresPrescription,
      description = @description, image_path = @imagePath, is_active = @isActive, updated_at = datetime('now')
     WHERE id = @id`
  ).run({ id, ...data });
  return db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
}

export function setBasePrice(medicineId, price, reorderLevel = 10) {
  const db = getDb();
  const pharmacies = db.prepare('SELECT id FROM pharmacies WHERE is_active = 1').all();
  const upsert = db.prepare(
    `INSERT INTO pharmacy_medicines (pharmacy_id, medicine_id, price, reorder_level)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (pharmacy_id, medicine_id) DO UPDATE SET price = excluded.price,
       reorder_level = excluded.reorder_level, updated_at = datetime('now')`
  );
  for (const p of pharmacies) upsert.run(p.id, medicineId, price, reorderLevel);
}

export function getPharmacyMedicine(pharmacyId, medicineId) {
  return getDb()
    .prepare(
      `SELECT pm.*, m.brand_name, m.generic_name FROM pharmacy_medicines pm
       JOIN medicines m ON m.id = pm.medicine_id
       WHERE pm.pharmacy_id = ? AND pm.medicine_id = ?`
    )
    .get(pharmacyId, medicineId);
}

export function upsertPharmacyMedicine({ pharmacyId, medicineId, price, reorderLevel, isActive = 1 }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO pharmacy_medicines (pharmacy_id, medicine_id, price, reorder_level, is_active)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (pharmacy_id, medicine_id) DO UPDATE SET price = excluded.price,
       reorder_level = excluded.reorder_level, is_active = excluded.is_active, updated_at = datetime('now')`
  ).run(pharmacyId, medicineId, price, reorderLevel, isActive ? 1 : 0);
  return getPharmacyMedicine(pharmacyId, medicineId);
}

export function logUnmet({ pharmacyId = null, medicineId = null, term, community = null }) {
  if (!term) return;
  getDb()
    .prepare('INSERT INTO unmet_requests (pharmacy_id, medicine_id, searched_term, community) VALUES (?, ?, ?, ?)')
    .run(pharmacyId, medicineId, String(term).slice(0, 200), community);
}
