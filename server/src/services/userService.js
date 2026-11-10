import { getDb } from '../db/index.js';
import * as usersRepo from '../repositories/users.js';
import { hashPassword, passwordProblems } from '../utils/password.js';
import { normalisePhone, isValidGhanaPhone } from '../utils/phone.js';
import { badRequest, conflict, notFound } from '../utils/http.js';
import { recordAudit } from '../repositories/audit.js';
import { anonymiseUser } from '../repositories/users.js';

const safeUser = (user) => {
  if (!user) return user;
  const { password_hash: _hash, ...safe } = user;
  return safe;
};

function validateAssignment(role, pharmacyId) {
  if (['pharmacist', 'rider'].includes(role) && !pharmacyId) {
    throw badRequest('Pharmacists and riders must be assigned to a pharmacy.');
  }
  if (['admin', 'customer'].includes(role) && pharmacyId) {
    throw badRequest('Only pharmacists and riders can belong to a pharmacy.');
  }
}

export async function createUser(input, actorId, ip) {
  const phone = normalisePhone(input.phone);
  if (!isValidGhanaPhone(phone)) throw badRequest('Enter a valid Ghana mobile number.');
  if (usersRepo.findByPhone(phone)) throw conflict('An account with this phone number already exists.');
  if (input.email && usersRepo.findByEmail(input.email)) {
    throw conflict('An account with this email address already exists.');
  }
  const problems = passwordProblems(input.password);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}.`);
  validateAssignment(input.role, input.pharmacyId);

  const user = usersRepo.createUser({
    role: input.role,
    fullName: input.fullName.trim(),
    phone,
    email: input.email ? input.email.toLowerCase() : null,
    passwordHash: await hashPassword(input.password),
    pharmacyId: input.pharmacyId || null,
    community: input.community || null,
    deliveryAddress: input.deliveryAddress || null,
    digitalAddressCode: input.digitalAddressCode || null,
    consentAt: new Date().toISOString(),
    mustChangePassword: input.mustChangePassword ? 1 : 0,
  });
  if (input.role === 'customer') {
    getDb().prepare('INSERT OR IGNORE INTO carts (customer_id) VALUES (?)').run(user.id);
  }
  recordAudit({
    userId: actorId,
    action: 'user_created',
    entity: 'user',
    entityId: user.id,
    after: { role: user.role, phone: user.phone },
    ip,
  });
  return safeUser(user);
}

export async function updateUser(id, input, actorId, ip) {
  const current = usersRepo.findById(id);
  if (!current) throw notFound('User not found.');
  const phone = normalisePhone(input.phone);
  if (!isValidGhanaPhone(phone)) throw badRequest('Enter a valid Ghana mobile number.');
  const phoneOwner = usersRepo.findByPhone(phone);
  if (phoneOwner && phoneOwner.id !== id) throw conflict('That phone number belongs to another account.');
  if (input.email) {
    const emailOwner = usersRepo.findByEmail(input.email);
    if (emailOwner && emailOwner.id !== id) throw conflict('That email address belongs to another account.');
  }
  validateAssignment(input.role, input.pharmacyId);
  if (id === actorId && input.isActive === false) throw conflict('You cannot suspend your own account.');
  if (current.role === 'admin' && input.role !== 'admin') {
    const admins = getDb().prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1").get().c;
    if (admins <= 1) throw conflict('At least one active administrator must remain.');
  }
  if (input.password) {
    const problems = passwordProblems(input.password);
    if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}.`);
  }

  const updated = usersRepo.updateUserAdmin(id, {
    fullName: input.fullName.trim(),
    phone,
    email: input.email ? input.email.toLowerCase() : null,
    role: input.role,
    pharmacyId: input.pharmacyId || null,
    community: input.community || null,
    deliveryAddress: input.deliveryAddress || null,
    digitalAddressCode: input.digitalAddressCode || null,
    isActive: input.isActive === false ? 0 : 1,
    mustChangePassword:
      input.mustChangePassword === undefined ? null : input.mustChangePassword ? 1 : 0,
  });
  if (input.password) usersRepo.updatePassword(id, await hashPassword(input.password));
  recordAudit({
    userId: actorId,
    action: 'user_updated',
    entity: 'user',
    entityId: id,
    before: { role: current.role, phone: current.phone, is_active: current.is_active },
    after: { role: updated.role, phone: updated.phone, is_active: updated.is_active },
    ip,
  });
  return safeUser(updated);
}

export function setUserActive(id, isActive, actorId, ip) {
  id = Number(id);
  const current = usersRepo.findById(id);
  if (!current) throw notFound('User not found.');
  if (id === Number(actorId) && !isActive) throw conflict('You cannot suspend your own account.');
  const updated = usersRepo.setActive(id, isActive);
  recordAudit({
    userId: actorId,
    action: isActive ? 'user_activated' : 'user_suspended',
    entity: 'user',
    entityId: id,
    before: { is_active: current.is_active },
    after: { is_active: updated.is_active },
    ip,
  });
  return safeUser(updated);
}

export function listUsers(query) {
  return usersRepo.listUsers(query);
}

export function dataRequests() {
  return getDb()
    .prepare(
      `SELECT d.*, u.full_name, u.phone, u.email FROM data_requests d
       JOIN users u ON u.id = d.user_id ORDER BY d.created_at DESC`
    )
    .all();
}

export function processDataRequest(id, actorId, ip) {
  const request = getDb().prepare('SELECT * FROM data_requests WHERE id = ?').get(id);
  if (!request) throw notFound('Data request not found.');
  if (request.status === 'completed') throw conflict('This request has already been processed.');
  getDb().transaction(() => {
    if (request.type === 'delete') anonymiseUser(request.user_id);
    getDb()
      .prepare("UPDATE data_requests SET status = 'completed', processed_at = datetime('now') WHERE id = ?")
      .run(id);
  })();
  recordAudit({
    userId: actorId,
    action: `data_request_${request.type}_processed`,
    entity: 'user',
    entityId: request.user_id,
    ip,
  });
  return getDb().prepare('SELECT * FROM data_requests WHERE id = ?').get(id);
}
