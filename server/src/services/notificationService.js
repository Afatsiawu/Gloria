import { getDb } from '../db/index.js';
import { getSmsProvider } from './providers/sms.js';
import { getEmailProvider } from './providers/email.js';

function createInApp(userId, event, message, orderId = null) {
  if (!userId) return;
  getDb()
    .prepare(
      `INSERT INTO notifications (user_id, order_id, channel, event, message, status)
       VALUES (?, ?, 'in_app', ?, ?, 'sent')`
    )
    .run(userId, orderId, event, message);
}

/**
 * Central notification fan-out. Controllers/services call notifyUser and never
 * a vendor directly. SMS/email failures are logged but do not roll back the
 * business transaction (the in-app copy is always retained).
 */
export async function notifyUser(userId, event, message, { orderId = null, email = false } = {}) {
  if (!userId) return;
  const user = getDb().prepare('SELECT id, phone, email FROM users WHERE id = ?').get(userId);
  if (!user) return;
  createInApp(userId, event, message, orderId);
  try {
    await getSmsProvider().send(user.phone, message, { userId, orderId, event });
  } catch (err) {
    console.error('[notification:sms]', err.message);
  }
  if (user.email) {
    try {
      await getEmailProvider().send(user.email, `PharmaLink: ${event.replace(/_/g, ' ')}`, message, {
        userId,
        orderId,
        event,
      });
    } catch (err) {
      console.error('[notification:email]', err.message);
    }
  }
  if (email && !user.email) {
    // Email was explicitly requested but the account has no address; the in-app
    // copy and SMS still went out.
  }
}

export async function sendSms(to, event, message, meta = {}) {
  return getSmsProvider().send(to, message, { ...meta, event });
}

export async function sendEmail(to, subject, body, meta = {}) {
  return getEmailProvider().send(to, subject, body, meta);
}

/**
 * Sends to contact details that are not tied to an account (guest checkout).
 * Guest prescriptions and order updates still reach the phone number supplied
 * with the order. Failures are logged, never rolled back.
 */
export async function notifyContact({ phone, email } = {}, event, message, { orderId = null } = {}) {
  if (phone) {
    try {
      await getSmsProvider().send(phone, message, { orderId, event });
    } catch (err) {
      console.error('[notification:sms]', err.message);
    }
  }
  if (email) {
    try {
      await getEmailProvider().send(email, `PharmaLink: ${event.replace(/_/g, ' ')}`, message, { orderId, event });
    } catch (err) {
      console.error('[notification:email]', err.message);
    }
  }
}

/** Picks the account owner or the guest contact stored on the order. */
export async function notifyOrderRecipient(order, event, message, options = {}) {
  if (!order) return;
  if (order.customer_id) return notifyUser(order.customer_id, event, message, options);
  return notifyContact(
    { phone: order.guest_phone || null, email: order.guest_email || null },
    event,
    message,
    options
  );
}

export function listNotifications(userId, { pageSize = 50, offset = 0 } = {}) {
  return getDb()
    .prepare(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
    )
    .all(userId, pageSize, offset);
}

export function outbox({ channel, pageSize = 100, offset = 0 } = {}) {
  const db = getDb();
  const where = channel ? 'WHERE channel = ?' : '';
  const params = channel ? [channel] : [];
  return db
    .prepare(`SELECT * FROM notifications ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);
}
