import { getDb } from '../db/index.js';
import * as deliveryRepo from '../repositories/delivery.js';
import * as ordersRepo from '../repositories/orders.js';
import * as catalogueRepo from '../repositories/catalogue.js';
import { recordAudit } from '../repositories/audit.js';
import { resolvePharmacy } from '../utils/access.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http.js';
import { notifyUser } from './notificationService.js';
import { immediateTransaction } from '../db/index.js';

export function publicZones(pharmacyId) {
  const pharmacy = catalogueRepo.getPharmacy(pharmacyId);
  if (!pharmacy || !pharmacy.is_active) throw notFound('Pharmacy not found.');
  return deliveryRepo.listZones(pharmacyId);
}

export function zones(user, query) {
  const pharmacyId = resolvePharmacy(user, query.pharmacyId);
  return deliveryRepo.listZones(pharmacyId, query.includeInactive === 'true');
}

export function createZone(user, input) {
  const pharmacyId = resolvePharmacy(user, input.pharmacyId);
  const zone = deliveryRepo.createZone({
    pharmacyId,
    name: input.name,
    fee: input.fee,
    rules: input.rules,
  });
  recordAudit({ userId: user.id, action: 'delivery_zone_created', entity: 'delivery_zone', entityId: zone.id, after: zone });
  return zone;
}

export function updateZone(user, id, input) {
  const zone = deliveryRepo.getZone(id);
  if (!zone) throw notFound('Delivery zone not found.');
  resolvePharmacy(user, zone.pharmacy_id);
  const updated = deliveryRepo.updateZone(id, {
    name: input.name,
    fee: input.fee,
    rules: input.rules,
    isActive: input.isActive,
  });
  recordAudit({ userId: user.id, action: 'delivery_zone_updated', entity: 'delivery_zone', entityId: id, before: zone, after: updated });
  return updated;
}

export function deleteZone(user, id) {
  const zone = deliveryRepo.getZone(id);
  if (!zone) throw notFound('Delivery zone not found.');
  resolvePharmacy(user, zone.pharmacy_id);
  const used = getDb().prepare('SELECT COUNT(*) AS c FROM orders WHERE delivery_zone_id = ?').get(id).c;
  if (used) throw conflict('This zone has been used by orders. Deactivate it instead.');
  deliveryRepo.deleteZone(id);
  recordAudit({ userId: user.id, action: 'delivery_zone_deleted', entity: 'delivery_zone', entityId: id, before: zone });
}

export function riders(user, query) {
  const pharmacyId = resolvePharmacy(user, query.pharmacyId);
  return deliveryRepo.riders(pharmacyId);
}

export function assignRider(user, orderId, riderId) {
  const order = ordersRepo.findRaw(orderId);
  if (!order) throw notFound('Order not found.');
  resolvePharmacy(user, order.pharmacy_id);
  if (order.fulfilment !== 'delivery') throw badRequest('Only delivery orders have riders.');
  if (['completed', 'cancelled'].includes(order.status)) throw conflict('This order is closed.');
  const rider = getDb().prepare("SELECT * FROM users WHERE id = ? AND role = 'rider' AND is_active = 1").get(riderId);
  if (!rider || rider.pharmacy_id !== order.pharmacy_id) throw badRequest('Choose an active rider from this pharmacy.');
  const delivery = deliveryRepo.assignRider(orderId, riderId);
  ordersRepo.addEvent(orderId, order.status, `Rider ${rider.full_name} assigned`, user.id);
  recordAudit({ userId: user.id, action: 'rider_assigned', entity: 'order', entityId: orderId, after: { rider_id: riderId } });
  notifyUser(riderId, 'delivery_assigned', `You have been assigned delivery ${order.reference}.`, { orderId }).catch(() => {});
  if (order.customer_id) {
    notifyUser(order.customer_id, 'rider_assigned', `A rider has been assigned to order ${order.reference}.`, { orderId }).catch(() => {});
  }
  return delivery;
}

export function queue(user, query) {
  const pharmacyId = resolvePharmacy(user, query.pharmacyId);
  return deliveryRepo.deliveryQueue(pharmacyId);
}

export function riderDeliveries(user, query) {
  if (user.role !== 'rider') throw forbidden();
  return deliveryRepo.riderDeliveries(user.id, query.status);
}

export function riderUpdate(user, orderId, input) {
  if (user.role !== 'rider') throw forbidden();
  const delivery = deliveryRepo.getDelivery(orderId);
  if (!delivery || delivery.rider_id !== user.id) throw forbidden('This delivery is not assigned to you.');
  const order = ordersRepo.findRaw(orderId);
  if (!order) throw notFound('Order not found.');
  if (order.status === 'cancelled') throw conflict('This order was cancelled.');
  if (delivery.status === 'delivered') throw conflict('This delivery is already complete.');
  if (!['picked_up', 'out_for_delivery', 'delivered', 'failed'].includes(input.status)) {
    throw badRequest('Choose a valid delivery status.');
  }

  const targetOrderStatus =
    input.status === 'delivered' ? 'completed' : input.status === 'failed' ? 'ready' : 'out_for_delivery';

  immediateTransaction(() => {
    deliveryRepo.updateDeliveryStatus(orderId, input.status, input.notes);
    if (order.status !== targetOrderStatus) ordersRepo.updateStatus(orderId, targetOrderStatus);
    ordersRepo.addEvent(
      orderId,
      targetOrderStatus,
      input.notes || `Rider updated delivery to ${input.status.replace(/_/g, ' ')}`,
      user.id
    );
    recordAudit({
      userId: user.id,
      action: 'delivery_status_changed',
      entity: 'order',
      entityId: orderId,
      before: { status: delivery.status },
      after: { status: input.status },
    });
  });

  const messages = {
    picked_up: `Your order ${order.reference} has been picked up by the rider.`,
    out_for_delivery: `Your order ${order.reference} is on the way.`,
    delivered: `Your order ${order.reference} has been delivered. Thank you.`,
    failed: `The rider could not complete delivery of ${order.reference}. The pharmacy will contact you.`,
  };
  if (order.customer_id) notifyUser(order.customer_id, `delivery_${input.status}`, messages[input.status], { orderId }).catch(() => {});
  return { delivery: deliveryRepo.getDelivery(orderId), order: ordersRepo.findRaw(orderId) };
}
