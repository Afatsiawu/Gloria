import { getDb } from '../db/index.js';

const SAFE_FIELDS = `u.id, u.role, u.full_name, u.phone, u.email, u.pharmacy_id, u.community,
  u.delivery_address, u.digital_address_code, u.is_active, u.created_at,
  p.name AS pharmacy_name`;
const JOINS = 'FROM users u LEFT JOIN pharmacies p ON p.id = u.pharmacy_id';

export function findById(id) {
  return getDb().prepare(`SELECT ${SAFE_FIELDS}, u.password_hash ${JOINS} WHERE u.id = ?`).get(id);
}

export function findByIdentifier(identifier) {
  return getDb()
    .prepare(`SELECT ${SAFE_FIELDS}, u.password_hash ${JOINS} WHERE u.phone = ? OR lower(u.email) = lower(?)`)
    .get(identifier, identifier);
}

export function findByPhone(phone) {
  return getDb().prepare('SELECT * FROM users WHERE phone = ?').get(phone);
}

export function findByEmail(email) {
  return getDb().prepare('SELECT * FROM users WHERE lower(email) = lower(?)').get(email);
}

export function createUser(data) {
  const info = getDb()
    .prepare(
      `INSERT INTO users (role, full_name, phone, email, password_hash, pharmacy_id, community,
                          delivery_address, digital_address_code, consent_at)
       VALUES (@role, @fullName, @phone, @email, @passwordHash, @pharmacyId, @community,
               @deliveryAddress, @digitalAddressCode, @consentAt)`
    )
    .run(data);
  return findById(info.lastInsertRowid);
}

export function updateProfile(id, data) {
  getDb()
    .prepare(
      `UPDATE users SET full_name = @fullName, email = @email, community = @community,
        delivery_address = @deliveryAddress, digital_address_code = @digitalAddressCode,
        updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({ id, ...data });
  return findById(id);
}

export function updatePassword(id, passwordHash) {
  getDb()
    .prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
    .run(passwordHash, id);
}

export function updateUserAdmin(id, data) {
  getDb()
    .prepare(
      `UPDATE users SET full_name = @fullName, phone = @phone, email = @email, role = @role,
        pharmacy_id = @pharmacyId, community = @community, delivery_address = @deliveryAddress,
        digital_address_code = @digitalAddressCode, is_active = @isActive, updated_at = datetime('now')
       WHERE id = @id`
    )
    .run({ id, ...data });
  return findById(id);
}

export function setActive(id, isActive) {
  getDb().prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(isActive ? 1 : 0, id);
  return findById(id);
}

export function listUsers({ pageSize, offset, role, pharmacyId, q, active }) {
  const db = getDb();
  const where = [];
  const params = {};
  if (role) {
    where.push('u.role = @role');
    params.role = role;
  }
  if (pharmacyId) {
    where.push('u.pharmacy_id = @pharmacyId');
    params.pharmacyId = Number(pharmacyId);
  }
  if (active !== undefined) {
    where.push('u.is_active = @active');
    params.active = active ? 1 : 0;
  }
  if (q) {
    where.push('(u.full_name LIKE @q OR u.phone LIKE @q OR u.email LIKE @q)');
    params.q = `%${q}%`;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalStatement = db.prepare(`SELECT COUNT(*) AS c FROM users u ${clause}`);
  const total = Object.keys(params).length ? totalStatement.get(params).c : totalStatement.get().c;
  const items = db
    .prepare(
      `SELECT ${SAFE_FIELDS} ${JOINS} ${clause}
       ORDER BY u.created_at DESC, u.id DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset });
  return { items, total };
}

export function anonymiseUser(id) {
  getDb()
    .prepare(
      `UPDATE users SET full_name = 'Deleted customer', phone = ?, email = NULL,
        delivery_address = NULL, digital_address_code = NULL, is_active = 0,
        password_hash = '!', updated_at = datetime('now')
       WHERE id = ?`
    )
    .run(`deleted-${id}-${Date.now()}`, id);
}
