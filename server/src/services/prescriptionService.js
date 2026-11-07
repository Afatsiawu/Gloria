import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getDb, immediateTransaction } from '../db/index.js';
import { config } from '../config.js';
import * as ordersRepo from '../repositories/orders.js';
import { recordAudit } from '../repositories/audit.js';
import { notifyUser } from './notificationService.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http.js';

async function optimiseImage(file) {
  if (!file.mimetype.startsWith('image/')) return { stored: file.filename, mime: file.mimetype };
  const source = path.join(config.prescriptionsDir, file.filename);
  const targetName = `${path.parse(file.filename).name}.webp`;
  const target = path.join(config.prescriptionsDir, targetName);
  await sharp(source).rotate().resize({ width: 1400, withoutEnlargement: true }).webp({ quality: 78 }).toFile(target);
  fs.unlinkSync(source);
  return { stored: targetName, mime: 'image/webp' };
}

export async function uploadForOrder(orderId, user, file) {
  if (!file) throw badRequest('Choose a prescription file to upload.');
  const order = ordersRepo.findRaw(orderId);
  if (!order) throw notFound('Order not found.');
  if (order.customer_id !== user.id) throw forbidden();
  if (['cancelled', 'completed'].includes(order.status)) throw conflict('This order can no longer receive a prescription.');
  if (!ordersRepo.hasPomItems(orderId)) throw badRequest('This order does not contain prescription-only medicines.');
  const pending = getDb()
    .prepare("SELECT id FROM prescriptions WHERE order_id = ? AND status IN ('pending','approved')")
    .get(orderId);
  if (pending) throw conflict('A prescription for this order is already waiting or approved.');

  let stored;
  try {
    stored = await optimiseImage(file);
  } catch (err) {
    fs.rmSync(path.join(config.prescriptionsDir, file.filename), { force: true });
    throw badRequest('The prescription image could not be processed. Try a smaller photo.');
  }

  const prescription = immediateTransaction(() => {
    const info = getDb()
      .prepare(
        `INSERT INTO prescriptions (order_id, customer_id, file_path, original_name, mime_type, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      )
      .run(orderId, user.id, stored.stored, file.originalname?.slice(0, 255) || null, stored.mime);
    if (order.status !== 'awaiting_prescription') {
      ordersRepo.updateStatus(orderId, 'awaiting_prescription');
    }
    ordersRepo.addEvent(orderId, 'awaiting_prescription', 'Prescription uploaded; waiting for pharmacist review', user.id);
    recordAudit({
      userId: user.id,
      action: 'prescription_uploaded',
      entity: 'prescription',
      entityId: info.lastInsertRowid,
      after: { order_id: orderId },
    });
    return getDb().prepare('SELECT * FROM prescriptions WHERE id = ?').get(info.lastInsertRowid);
  });

  notifyUser(user.id, 'prescription_uploaded', 'Your prescription was uploaded and is waiting for pharmacist review.', {
    orderId,
  }).catch(() => {});
  const pharmacists = getDb()
    .prepare("SELECT id FROM users WHERE role = 'pharmacist' AND pharmacy_id = ? AND is_active = 1")
    .all(order.pharmacy_id);
  for (const pharmacist of pharmacists) {
    notifyUser(pharmacist.id, 'prescription_pending', `A prescription is waiting for review for order ${order.reference}.`, {
      orderId,
    }).catch(() => {});
  }
  return {
    id: prescription.id,
    order_id: prescription.order_id,
    status: prescription.status,
    original_name: prescription.original_name,
    mime_type: prescription.mime_type,
    created_at: prescription.created_at,
  };
}

export function queue(user, query) {
  const db = getDb();
  const where = [];
  const params = {};
  if (user.role === 'pharmacist') {
    where.push('o.pharmacy_id = @pharmacyId');
    params.pharmacyId = user.pharmacy_id;
  } else if (query.pharmacyId) {
    where.push('o.pharmacy_id = @pharmacyId');
    params.pharmacyId = Number(query.pharmacyId);
  }
  if (query.status) {
    where.push('p.status = @status');
    params.status = query.status;
  } else {
    where.push("p.status IN ('pending','queried')");
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const items = db
    .prepare(
      `SELECT p.id, p.order_id, p.status, p.original_name, p.mime_type, p.created_at, p.remarks,
              p.reviewed_at, o.reference, o.total, o.status AS order_status, o.pharmacy_id,
              ph.name AS pharmacy_name, u.full_name AS customer_name, u.phone AS customer_phone,
              (SELECT GROUP_CONCAT(m.brand_name, ', ') FROM order_items oi
                 JOIN medicines m ON m.id = oi.medicine_id
                WHERE oi.order_id = o.id AND m.requires_prescription = 1) AS pom_items
         FROM prescriptions p
         JOIN orders o ON o.id = p.order_id
         JOIN pharmacies ph ON ph.id = o.pharmacy_id
         LEFT JOIN users u ON u.id = p.customer_id
         ${clause}
        ORDER BY p.created_at ASC, p.id ASC LIMIT 200`
    )
    .all(params);
  return items;
}

export function review(prescriptionId, user, { status, remarks }) {
  if (!['approved', 'rejected', 'queried'].includes(status)) throw badRequest('Choose approve, reject or query.');
  if (['rejected', 'queried'].includes(status) && !remarks?.trim()) {
    throw badRequest('Add remarks explaining your decision.');
  }
  const db = getDb();
  const prescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(prescriptionId);
  if (!prescription) throw notFound('Prescription not found.');
  const order = ordersRepo.findRaw(prescription.order_id);
  if (user.role === 'pharmacist' && order.pharmacy_id !== user.pharmacy_id) throw forbidden();
  if (user.role !== 'pharmacist' && user.role !== 'admin') throw forbidden();
  if (prescription.status === 'approved' && status === 'approved') return prescription;

  const updated = immediateTransaction(() => {
    db.prepare(
      `UPDATE prescriptions SET status = ?, remarks = ?, reviewed_by = ?, reviewed_at = datetime('now')
       WHERE id = ?`
    ).run(status, remarks || null, user.id, prescriptionId);
    ordersRepo.addEvent(
      order.id,
      status === 'approved' ? 'prescription_approved' : `prescription_${status}`,
      remarks || null,
      user.id
    );
    recordAudit({
      userId: user.id,
      action: `prescription_${status}`,
      entity: 'prescription',
      entityId: prescriptionId,
      before: { status: prescription.status },
      after: { status, remarks: remarks || null },
    });

    if (status === 'approved') {
      const remaining = ordersRepo.pendingPrescriptionCount(order.id);
      if (remaining === 0 && order.payment_status !== 'pending' && ['awaiting_prescription', 'placed'].includes(order.status)) {
        ordersRepo.updateStatus(order.id, 'verified');
        ordersRepo.addEvent(order.id, 'verified', 'Prescription approved and payment confirmed', user.id);
      }
    }
    return db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(prescriptionId);
  });

  const messages = {
    approved: `Good news: your prescription for order ${order.reference} was approved by the pharmacist.`,
    rejected: `Your prescription for order ${order.reference} was rejected. Remarks: ${remarks}`,
    queried: `The pharmacist needs clarification on your prescription for order ${order.reference}. Remarks: ${remarks}`,
  };
  if (order.customer_id) {
    notifyUser(order.customer_id, `prescription_${status}`, messages[status], { orderId: order.id }).catch(() => {});
  }
  return updated;
}

export function fileFor(prescriptionId, user) {
  const db = getDb();
  const prescription = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(prescriptionId);
  if (!prescription) throw notFound('Prescription not found.');
  const order = ordersRepo.findRaw(prescription.order_id);
  if (!order) throw notFound('Order not found.');
  if (user.role === 'customer') {
    if (order.customer_id !== user.id) throw forbidden();
  } else if (user.role === 'pharmacist') {
    if (order.pharmacy_id !== user.pharmacy_id) throw forbidden();
  } else if (user.role !== 'admin') {
    throw forbidden();
  }
  const absolute = path.resolve(config.prescriptionsDir, prescription.file_path);
  if (!absolute.startsWith(path.resolve(config.prescriptionsDir) + path.sep)) {
    throw forbidden('Invalid file path.');
  }
  if (!fs.existsSync(absolute)) throw notFound('The prescription file is no longer available.');
  return { absolute, mime: prescription.mime_type || 'application/octet-stream', prescription, order };
}
