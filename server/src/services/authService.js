import { getDb } from '../db/index.js';
import * as usersRepo from '../repositories/users.js';
import { hashPassword, hashSecret, verifyPassword, verifySecret, passwordProblems } from '../utils/password.js';
import { normalisePhone, isValidGhanaPhone } from '../utils/phone.js';
import { ApiError, badRequest, conflict, unauthorized } from '../utils/http.js';
import { sixDigitCode } from '../utils/reference.js';
import { sendSms, sendEmail, listNotifications } from './notificationService.js';
import { recordAudit } from '../repositories/audit.js';

export const publicUser = (user) => {
  if (!user) return null;
  const { password_hash: _hash, ...safe } = user;
  const { must_change_password: mustChange, ...rest } = safe;
  // camelCase fields are the contract the client relies on for routing.
  // The remaining snake_case fields feed existing profile screens.
  return {
    ...rest,
    fullName: user.full_name,
    pharmacyId: user.pharmacy_id,
    pharmacyName: user.pharmacy_name,
    mustChangePassword: Boolean(mustChange),
  };
};

export async function register(input, ip) {
  const phone = normalisePhone(input.phone);
  if (!isValidGhanaPhone(phone)) {
    throw badRequest('Enter a valid Ghana mobile number, for example 024 123 4567.');
  }
  if (usersRepo.findByPhone(phone)) throw conflict('An account with this phone number already exists.');
  if (input.email && usersRepo.findByEmail(input.email)) {
    throw conflict('An account with this email address already exists.');
  }
  const problems = passwordProblems(input.password);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}.`);

  const passwordHash = await hashPassword(input.password);
  const user = usersRepo.createUser({
    role: 'customer',
    fullName: input.fullName.trim(),
    phone,
    email: input.email ? input.email.toLowerCase() : null,
    passwordHash,
    pharmacyId: null,
    community: input.community,
    deliveryAddress: input.deliveryAddress || null,
    digitalAddressCode: input.digitalAddressCode || null,
    consentAt: input.consent ? new Date().toISOString() : null,
  });
  getDb().prepare('INSERT OR IGNORE INTO carts (customer_id) VALUES (?)').run(user.id);
  recordAudit({
    userId: user.id,
    action: 'register',
    entity: 'user',
    entityId: user.id,
    after: { phone: user.phone, role: user.role },
    ip,
  });
  return publicUser(user);
}

export async function login(input, ip) {
  let identifier = input.identifier.trim();
  if (isValidGhanaPhone(identifier)) identifier = normalisePhone(identifier);
  else identifier = identifier.toLowerCase();
  const user = usersRepo.findByIdentifier(identifier);
  if (!user || !(await verifyPassword(input.password, user.password_hash))) {
    throw unauthorized('Phone/email or password is incorrect.');
  }
  if (!user.is_active) throw unauthorized('This account is suspended. Contact the pharmacy.');
  recordAudit({
    userId: user.id,
    action: 'login',
    entity: 'user',
    entityId: user.id,
    ip,
  });
  return publicUser(user);
}

export async function forgotPassword(input) {
  let identifier = input.identifier.trim();
  if (isValidGhanaPhone(identifier)) identifier = normalisePhone(identifier);
  else identifier = identifier.toLowerCase();
  const user = usersRepo.findByIdentifier(identifier);
  const response = {
    message: 'If an account matches, a one-time code has been sent. It expires in 10 minutes.',
  };
  if (!user || !user.is_active) return response;

  const channel = input.channel || (user.email && !isValidGhanaPhone(input.identifier) ? 'email' : 'sms');
  const code = sixDigitCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  getDb()
    .prepare(
      `INSERT INTO password_resets (user_id, code_hash, channel, expires_at) VALUES (?, ?, ?, ?)`
    )
    .run(user.id, codeHash, channel, expiresAt);

  if (channel === 'email' && user.email) {
    await sendEmail(
      user.email,
      'Your PharmaLink password reset code',
      `Your one-time reset code is ${code}. It expires in 10 minutes. If you did not request it, ignore this message.`,
      { userId: user.id, event: 'password_reset' }
    );
  } else {
    await sendSms(
      user.phone,
      'password_reset',
      `PharmaLink reset code: ${code}. Expires in 10 minutes. Do not share this code.`,
      { userId: user.id }
    );
  }
  if (process.env.NODE_ENV !== 'production') response.dev_code = code;
  return response;
}

export async function resetPassword(input, ip) {
  let identifier = input.identifier.trim();
  if (isValidGhanaPhone(identifier)) identifier = normalisePhone(identifier);
  else identifier = identifier.toLowerCase();
  const user = usersRepo.findByIdentifier(identifier);
  if (!user) throw badRequest('The code is invalid or has expired.');
  const row = getDb()
    .prepare(
      `SELECT * FROM password_resets WHERE user_id = ? AND used_at IS NULL
       ORDER BY id DESC LIMIT 1`
    )
    .get(user.id);
  if (!row) throw badRequest('The code is invalid or has expired.');
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw badRequest('The code has expired. Request a new one.');
  }
  const ok = await verifySecret(input.code, row.code_hash);
  if (!ok) throw badRequest('The code is invalid or has expired.');
  const problems = passwordProblems(input.password);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}.`);

  const passwordHash = await hashPassword(input.password);
  getDb().transaction(() => {
    usersRepo.updatePassword(user.id, passwordHash);
    getDb().prepare("UPDATE password_resets SET used_at = datetime('now') WHERE id = ?").run(row.id);
  })();
  recordAudit({ userId: user.id, action: 'password_reset', entity: 'user', entityId: user.id, ip });
  return { message: 'Your password has been reset. You can now sign in.' };
}

export function updateProfile(userId, input, ip) {
  const current = usersRepo.findById(userId);
  if (!current) throw new ApiError(404, 'NOT_FOUND', 'Account not found.');
  const email = input.email ? input.email.toLowerCase() : null;
  if (email) {
    const existing = usersRepo.findByEmail(email);
    if (existing && existing.id !== userId) throw conflict('That email address is already in use.');
  }
  const updated = usersRepo.updateProfile(userId, {
    fullName: input.fullName.trim(),
    email,
    community: input.community,
    deliveryAddress: input.deliveryAddress || null,
    digitalAddressCode: input.digitalAddressCode || null,
  });
  recordAudit({
    userId,
    action: 'profile_update',
    entity: 'user',
    entityId: userId,
    before: {
      full_name: current.full_name,
      email: current.email,
      community: current.community,
      delivery_address: current.delivery_address,
      digital_address_code: current.digital_address_code,
    },
    after: {
      full_name: updated.full_name,
      email: updated.email,
      community: updated.community,
      delivery_address: updated.delivery_address,
      digital_address_code: updated.digital_address_code,
    },
    ip,
  });
  return publicUser(updated);
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = usersRepo.findById(userId);
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    throw badRequest('Your current password is incorrect.');
  }
  const problems = passwordProblems(newPassword);
  if (problems.length) throw badRequest(`Password must contain ${problems.join(', ')}.`);
  usersRepo.updatePassword(userId, await hashPassword(newPassword));
  usersRepo.clearMustChangePassword(userId);
}

export async function requestOrderLink(userId) {
  const user = usersRepo.findById(userId);
  if (!user) throw unauthorized('Please sign in to continue.');
  const pending = getDb()
    .prepare('SELECT COUNT(*) AS c FROM orders WHERE guest_phone = ? AND customer_id IS NULL')
    .get(user.phone).c;
  if (!pending) {
    return {
      eligible: false,
      message: 'No past guest orders were found for this phone number.',
    };
  }

  const code = sixDigitCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  getDb()
    .prepare('INSERT INTO order_link_codes (user_id, code_hash, expires_at) VALUES (?, ?, ?)')
    .run(userId, codeHash, expiresAt);
  await sendSms(
    user.phone,
    'order_link',
    `PharmaLink code to link your past orders: ${code}. Expires in 10 minutes. Do not share it.`,
    { userId }
  );

  const response = {
    eligible: true,
    count: pending,
    message: 'Enter the 6-digit code sent to your phone to link those orders.',
  };
  if (process.env.NODE_ENV !== 'production') response.dev_code = code;
  return response;
}

export async function verifyOrderLink(userId, code) {
  const user = usersRepo.findById(userId);
  if (!user) throw unauthorized('Please sign in to continue.');
  const row = getDb()
    .prepare(
      `SELECT * FROM order_link_codes WHERE user_id = ? AND used_at IS NULL
       ORDER BY id DESC LIMIT 1`
    )
    .get(userId);
  if (!row) throw badRequest('The code is invalid or has expired.');
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw badRequest('The code has expired. Request a new one.');
  }
  if (!(await verifySecret(code, row.code_hash))) {
    throw badRequest('The code is invalid or has expired.');
  }

  let linked = 0;
  getDb().transaction(() => {
    const result = getDb()
      .prepare(
        `UPDATE orders SET customer_id = ?, updated_at = datetime('now')
         WHERE guest_phone = ? AND customer_id IS NULL`
      )
      .run(userId, user.phone);
    linked = result.changes;
    getDb()
      .prepare("UPDATE order_link_codes SET used_at = datetime('now') WHERE id = ?")
      .run(row.id);
  })();
  return {
    linked,
    message: linked
      ? `${linked} past order${linked === 1 ? '' : 's'} linked to your account.`
      : 'There were no past orders left to link.',
  };
}

/** Data Protection Act 2012 (Act 843): subject access request. */
export function exportMyData(userId) {
  const db = getDb();
  const user = publicUser(usersRepo.findById(userId));
  return {
    exported_at: new Date().toISOString(),
    profile: user,
    orders: db
      .prepare(
        `SELECT o.reference, o.status, o.fulfilment, o.subtotal, o.delivery_fee, o.total, o.created_at,
                p.name AS pharmacy_name
           FROM orders o JOIN pharmacies p ON p.id = o.pharmacy_id
          WHERE o.customer_id = ? ORDER BY o.created_at DESC`
      )
      .all(userId),
    prescriptions: db
      .prepare('SELECT id, order_id, status, original_name, created_at FROM prescriptions WHERE customer_id = ?')
      .all(userId),
    notifications: listNotifications(userId, { pageSize: 500 }),
    refill_reminders: db.prepare('SELECT * FROM refill_reminders WHERE user_id = ?').all(userId),
    data_requests: db.prepare('SELECT * FROM data_requests WHERE user_id = ? ORDER BY id DESC').all(userId),
  };
}

export function requestDeletion(userId) {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM data_requests WHERE user_id = ? AND type = 'delete' AND status = 'pending'")
    .get(userId);
  if (existing) return existing;
  const info = db
    .prepare("INSERT INTO data_requests (user_id, type, status) VALUES (?, 'delete', 'pending')")
    .run(userId);
  recordAudit({ userId, action: 'data_delete_requested', entity: 'user', entityId: userId });
  return db.prepare('SELECT * FROM data_requests WHERE id = ?').get(info.lastInsertRowid);
}
