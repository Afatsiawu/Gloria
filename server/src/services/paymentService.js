import { getDb } from '../db/index.js';
import * as ordersRepo from '../repositories/orders.js';
import { restoreOrderStock } from '../repositories/inventory.js';
import { getPaymentProvider } from './providers/payment.js';
import { notifyUser } from './notificationService.js';
import { recordAudit } from '../repositories/audit.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http.js';

export function createCashPayment(orderId, amount) {
  const db = getDb();
  const order = ordersRepo.findRaw(orderId);
  const info = db
    .prepare(
      `INSERT INTO payments (order_id, method, reference, provider, status, amount)
       VALUES (?, 'cash', ?, 'counter', 'success', ?)`
    )
    .run(orderId, `CASH-${order.reference}`, amount);
  return db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
}

export function createPendingMomoPayment(orderId, amount, network, phone) {
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO payments (order_id, method, network, phone, status, amount)
       VALUES (?, 'momo', ?, ?, 'pending', ?)`
    )
    .run(orderId, network, phone, amount);
  return db.prepare('SELECT * FROM payments WHERE id = ?').get(info.lastInsertRowid);
}

export async function initiateMomoPayment(orderId, phone, network) {
  const db = getDb();
  const order = ordersRepo.findRaw(orderId);
  const payment = db
    .prepare("SELECT * FROM payments WHERE order_id = ? AND method = 'momo' AND status = 'pending' ORDER BY id DESC LIMIT 1")
    .get(orderId);
  if (!order || !payment) throw notFound('Pending mobile money payment not found.');
  try {
    const result = await getPaymentProvider().initiate(order, phone, network);
    db.prepare("UPDATE payments SET reference = ?, provider = ?, updated_at = datetime('now') WHERE id = ?").run(
      result.reference,
      result.provider,
      payment.id
    );
    scheduleMomoCheck(orderId);
    return db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id);
  } catch (err) {
    applyMomoResult(payment, 'failed');
    throw err;
  }
}

function scheduleMomoCheck(orderId) {
  const timer = setTimeout(() => {
    const payment = getDb()
      .prepare("SELECT * FROM payments WHERE order_id = ? AND method = 'momo' AND status = 'pending' ORDER BY id DESC LIMIT 1")
      .get(orderId);
    if (!payment) return;
    verifyPayment(payment.id, null, { system: true }).catch((err) => console.error('[payment] auto verify failed', err.message));
  }, Math.max(0, Number(process.env.MOCK_PAYMENT_DELAY_MS ?? 4000)) + 750);
  timer.unref?.();
}

export function accessPayment(payment, user) {
  const order = ordersRepo.findRaw(payment.order_id);
  if (!ordersRepo.canUserAccessOrder(order, user)) throw forbidden();
  return order;
}

export async function verifyPayment(paymentId, user, { system = false } = {}) {
  const db = getDb();
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
  if (!payment) throw notFound('Payment not found.');
  const order = system ? ordersRepo.findRaw(payment.order_id) : accessPayment(payment, user);
  if (payment.method === 'cash' || payment.status !== 'pending') return { payment, order };
  if (!payment.reference) {
    return { payment, order };
  }
  const result = await getPaymentProvider().verify(payment.reference);
  if (result.status === 'pending') return { payment, order };
  return applyMomoResult(payment, result.status);
}

function applyMomoResult(payment, status) {
  const db = getDb();
  const order = ordersRepo.findRaw(payment.order_id);
  const updated = db.transaction(() => {
    db.prepare("UPDATE payments SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, payment.id);
    if (status === 'success') {
      ordersRepo.setPaymentStatus(order.id, 'success');
      db.prepare(
        `INSERT INTO order_events (order_id, status, note) VALUES (?, ?, 'Mobile money payment confirmed')`
      ).run(order.id, order.status);
      if (order.status === 'awaiting_prescription' && ordersRepo.hasPomItems(order.id)) {
        const approved = db
          .prepare("SELECT COUNT(*) AS c FROM prescriptions WHERE order_id = ? AND status = 'approved'")
          .get(order.id).c;
        if (approved > 0 && ordersRepo.pendingPrescriptionCount(order.id) === 0) {
          ordersRepo.updateStatus(order.id, 'verified');
          ordersRepo.addEvent(order.id, 'verified', 'Payment and prescription both confirmed');
        }
      }
      return { payment: db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id), order: ordersRepo.findRaw(order.id) };
    }
    // Failed payment: release the reserved stock and cancel the order.
    restoreOrderStock(order.id);
    ordersRepo.updateStatus(order.id, 'cancelled', 'failed');
    ordersRepo.addEvent(order.id, 'cancelled', 'Mobile money payment failed; reserved stock released');
    recordAudit({
      userId: null,
      action: 'order_cancelled',
      entity: 'order',
      entityId: order.id,
      after: { reason: 'payment_failed' },
    });
    return { payment: db.prepare('SELECT * FROM payments WHERE id = ?').get(payment.id), order: ordersRepo.findRaw(order.id) };
  })();

  const message =
    status === 'success'
      ? `Payment of GHS ${payment.amount.toFixed(2)} for order ${order.reference} was received. Thank you.`
      : `Payment for order ${order.reference} failed. The order was cancelled and stock released. Please try again.`;
  if (order.customer_id) {
    notifyUser(order.customer_id, status === 'success' ? 'payment_received' : 'payment_failed', message, {
      orderId: order.id,
    }).catch(() => {});
  }
  return updated;
}

export function listPaymentsForOrder(orderId, user) {
  const order = ordersRepo.findRaw(orderId);
  if (!order) throw notFound('Order not found.');
  if (!ordersRepo.canUserAccessOrder(order, user)) throw forbidden();
  return ordersRepo.payments(orderId);
}

export function ensureMomoRetry(orderId) {
  const order = ordersRepo.findRaw(orderId);
  if (!order) throw notFound('Order not found.');
  if (order.payment_status === 'success') throw conflict('This order is already paid.');
}
