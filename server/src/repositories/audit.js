import { getDb } from '../db/index.js';

export function recordAudit({ userId = null, action, entity, entityId = null, before = null, after = null, ip = null }) {
  getDb()
    .prepare(
      `INSERT INTO audit_log (user_id, action, entity, entity_id, before_json, after_json, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      action,
      entity,
      entityId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      ip
    );
}

export function listAudit({ page, pageSize, offset, entity, action, userId }) {
  const db = getDb();
  const where = [];
  const params = {};
  if (entity) {
    where.push('a.entity = @entity');
    params.entity = entity;
  }
  if (action) {
    where.push('a.action LIKE @action');
    params.action = `%${action}%`;
  }
  if (userId) {
    where.push('a.user_id = @userId');
    params.userId = userId;
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log a ${clause}`).get(params).c;
  const items = db
    .prepare(
      `SELECT a.*, u.full_name AS user_name, u.role AS user_role
         FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
         ${clause}
        ORDER BY a.created_at DESC, a.id DESC LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset });
  return { items, total, page, pageSize };
}
