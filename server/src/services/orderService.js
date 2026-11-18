import { getDb, immediateTransaction } from '../db/index.js';
import * as ordersRepo from '../repositories/orders.js';
import * as cartRepo from '../repositories/cart.js';
import * as catalogueRepo from '../repositories/catalogue.js';
import * as deliveryRepo from '../repositories/delivery.js';
import { allocateFefo, availableStock, restoreOrderStock } from '../repositories/inventory.js';
import { orderReference } from '../utils/reference.js';
import { roundMoney, badRequest, conflict, forbidden, notFound } from '../utils/http.js';
import { normalisePhone, isValidGhanaPhone, maskPhone } from '../utils/phone.js';
import { notifyUser, notifyOrderRecipient } from './notificationService.js';
import { recordAudit } from '../repositories/audit.js';
import {
  createCashPayment,
  createPendingMomoPayment,
  initiateMomoPayment,
} from './paymentService.js';
import { pagination, paged } from '../utils/pagination.js';

const DELIVERY_DIGITAL = /^[A-Za-z]{2}-\d{3}-\d{4}$/;
const TRACK_ERROR = 'We could not find an order with that reference and phone number.';

function resolveDelivery(pharmacyId, input, fallbackAddress = null, fallbackDigital = null) {
  if (input.fulfilment !== 'delivery') {
    return { zoneId: null, deliveryFee: 0, deliveryAddress: null, digitalAddressCode: null };
  }
  const zone = deliveryRepo.getZone(input.deliveryZoneId);
  if (!zone || !zone.is_active || zone.pharmacy_id !== pharmacyId) {
    throw badRequest('Choose a valid delivery zone for this pharmacy.');
  }
  const deliveryAddress = (input.deliveryAddress || fallbackAddress || '').trim();
  const digitalAddressCode = (input.digitalAddressCode || fallbackDigital || '').trim();
  if (!deliveryAddress) throw badRequest('A delivery address or landmark is required.');
  if (!DELIVERY_DIGITAL.test(digitalAddressCode)) {
    throw badRequest('Enter a valid Ghana Post GPS digital address, for example GA-123-4567.');
  }
  return { zoneId: zone.id, deliveryFee: zone.fee, deliveryAddress, digitalAddressCode };
}

function scopeFor(user, query = {}) {
  if (user.role === 'customer') return { customerId: user.id };
  if (user.role === 'pharmacist') return { pharmacyId: user.pharmacy_id };
  if (user.role === 'rider') return { riderId: user.id };
  return query.pharmacyId ? { pharmacyId: Number(query.pharmacyId) } : {};
}

export function listOrders(user, query) {
  const { page, pageSize, offset } = pagination(query);
  const result = ordersRepo.list({ ...query, pageSize, offset }, scopeFor(user, query));
  return paged(result.items, result.total, page, pageSize);
}

export function getOrder(id, user) {
  const order = ordersRepo.detail(id);
  if (!order) throw notFound('Order not found.');
  if (!ordersRepo.canUserAccessOrder(ordersRepo.findRaw(id), user)) throw forbidden();
  return order;
}

export function timeline(id, user) {
  const order = getOrder(id, user);
  return {
    reference: order.reference,
    status: order.status,
    payment_status: order.payment_status,
    updated_at: order.updated_at,
    events: order.events,
  };
}

export async function placeOrder(user, input) {
  const customerPhone = normalisePhone(input.phone || user.phone);
  if (input.paymentMethod === 'momo') {
    if (!input.network) throw badRequest('Choose a mobile money network.');
    if (!isValidGhanaPhone(customerPhone)) throw badRequest('Enter a valid mobile money phone number.');
  }

  const result = immediateTransaction(() => {
    const cart = cartRepo.getCart(user.id);
    if (!cart.items.length || !cart.pharmacy) throw badRequest('Your cart is empty.');
    const pharmacy = catalogueRepo.getPharmacy(cart.pharmacy.id);
    if (!pharmacy || !pharmacy.is_active) throw conflict('The selected pharmacy is not available.');

    let deliveryFee = 0;
    let zoneId = null;
    let deliveryAddress = null;
    let digitalAddressCode = null;
    if (input.fulfilment === 'delivery') {
      const delivery = resolveDelivery(cart.pharmacy.id, input, user.delivery_address, user.digital_address_code);
      ({ zoneId, deliveryFee, deliveryAddress, digitalAddressCode } = delivery);
    }

    const items = cart.items.map((item) => {
      const pm = catalogueRepo.getPharmacyMedicine(cart.pharmacy.id, item.medicine_id);
      if (!pm || !pm.is_active) throw conflict(`${item.brand_name} is no longer sold by this pharmacy.`);
      return {
        medicineId: item.medicine_id,
        quantity: item.quantity,
        unitPrice: pm.price,
        name: `${item.brand_name}${item.strength ? ` ${item.strength}` : ''}`,
        requiresPrescription: item.requires_prescription,
      };
    });
    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const total = roundMoney(subtotal + deliveryFee);
    const requiresPrescription = items.some((item) => item.requiresPrescription);
    const status = requiresPrescription ? 'awaiting_prescription' : 'placed';
    const paymentStatus = input.paymentMethod === 'cash' ? 'cash_on_pickup' : 'pending';

    let reference = orderReference();
    while (ordersRepo.findByReference(reference)) reference = orderReference();

    const orderId = ordersRepo.createOrder({
      reference,
      customerId: user.id,
      guestName: null,
      guestPhone: null,
      guestEmail: null,
      consentGivenAt: null,
      pharmacyId: cart.pharmacy.id,
      channel: 'online',
      fulfilment: input.fulfilment,
      deliveryZoneId: zoneId,
      deliveryFee,
      deliveryAddress,
      digitalAddressCode,
      status,
      paymentStatus,
      subtotal,
      total,
      notes: input.notes || null,
      createdBy: user.id,
    });

    for (const item of items) {
      const allocations = allocateFefo(cart.pharmacy.id, item.medicineId, item.quantity);
      const orderItemId = ordersRepo.addItem(orderId, item);
      for (const allocation of allocations) {
        ordersRepo.addAllocation(orderItemId, allocation.batchId, allocation.quantity);
      }
    }

    if (input.paymentMethod === 'cash') createCashPayment(orderId, total);
    else createPendingMomoPayment(orderId, total, input.network, customerPhone);

    if (input.fulfilment === 'delivery') deliveryRepo.createDelivery(orderId);
    ordersRepo.addEvent(
      orderId,
      status,
      requiresPrescription
        ? 'Order placed. Waiting for a prescription so a pharmacist can verify it.'
        : 'Order placed by the customer.'
    );
    cartRepo.clearCart(cart.id);
    recordAudit({
      userId: user.id,
      action: 'order_placed',
      entity: 'order',
      entityId: orderId,
      after: { reference, total, payment_method: input.paymentMethod },
    });
    return { orderId, reference, paymentMethod: input.paymentMethod, total, phone: customerPhone, network: input.network };
  });

  if (result.paymentMethod === 'momo') {
    await initiateMomoPayment(result.orderId, result.phone, result.network);
  }

  const order = getOrder(result.orderId, user);
  const message =
    order.status === 'awaiting_prescription'
      ? `Order ${order.reference} received. Upload your prescription so a pharmacist can verify it before release.`
      : `Order ${order.reference} received by ${order.pharmacy_name}. Total GHS ${order.total.toFixed(2)}.`;
  notifyUser(user.id, 'order_confirmation', message, { orderId: order.id }).catch(() => {});
  return order;
}

/**
 * Order shape returned to guests. It deliberately omits internal ids, staff
 * details, audit fields and prescription file paths. The order id is included
 * so the guest can attach a prescription after a "queried" review.
 */
export function publicOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    payment_status: order.payment_status,
    fulfilment: order.fulfilment,
    delivery_address: order.delivery_address,
    digital_address_code: order.digital_address_code,
    delivery_fee: order.delivery_fee,
    subtotal: order.subtotal,
    total: order.total,
    notes: order.notes,
    created_at: order.created_at,
    updated_at: order.updated_at,
    delivery_zone_name: order.delivery_zone_name,
    pharmacy: {
      id: order.pharmacy_id,
      name: order.pharmacy_name,
      community: order.pharmacy_community,
      phone: order.pharmacy_phone,
      address: order.pharmacy_address,
      landmark: order.pharmacy_landmark,
    },
    items: (order.items || []).map((item) => ({
      id: item.id,
      medicine_id: item.medicine_id,
      brand_name: item.brand_name,
      generic_name: item.generic_name,
      strength: item.strength,
      dosage_form: item.dosage_form,
      quantity: item.quantity,
      unit_price: item.unit_price,
      requires_prescription: item.requires_prescription,
    })),
    prescriptions: (order.prescriptions || []).map((prescription) => ({
      id: prescription.id,
      status: prescription.status,
      remarks: prescription.remarks,
      reviewed_at: prescription.reviewed_at,
      created_at: prescription.created_at,
    })),
    events: (order.events || []).map((event) => ({
      status: event.status,
      note: event.note,
      created_at: event.created_at,
    })),
  };
}

export function trackOrder({ reference, phone }) {
  const guestPhone = normalisePhone(phone);
  const order = ordersRepo.findByReference(String(reference || '').trim().toUpperCase());
  // Same response for an unknown reference and a wrong phone so references
  // cannot be probed.
  if (!order || !order.guest_phone || order.guest_phone !== guestPhone) throw notFound(TRACK_ERROR);
  return publicOrder(ordersRepo.detail(order.id));
}

/** Verifies guest ownership before accepting a prescription file. */
export function guestOrderByProof(orderId, { reference, phone }) {
  const order = ordersRepo.findRaw(orderId);
  if (
    !order ||
    !order.guest_phone ||
    order.reference !== String(reference || '').trim().toUpperCase() ||
    order.guest_phone !== normalisePhone(phone)
  ) {
    throw notFound(TRACK_ERROR);
  }
  return order;
}

/**
 * Places an order from the browser's guest cart. The items and pharmacy arrive
 * with the request because guests have no server-side cart. Stock, FEFO,
 * payment and delivery rules are identical to a signed-in order.
 */
export async function placeGuestOrder(input, ip = null) {
  const guestPhone = normalisePhone(input.phone);
  if (!isValidGhanaPhone(guestPhone)) throw badRequest('Enter a valid Ghana phone number.');
  const momoPhone = normalisePhone(input.momoPhone || guestPhone);
  if (input.paymentMethod === 'momo') {
    if (!input.network) throw badRequest('Choose a mobile money network.');
    if (!isValidGhanaPhone(momoPhone)) throw badRequest('Enter a valid mobile money phone number.');
  }
  if (!input.consent) throw badRequest('You must agree to the privacy notice before placing an order.');

  const result = immediateTransaction(() => {
    const pharmacy = catalogueRepo.getPharmacy(input.pharmacyId);
    if (!pharmacy || !pharmacy.is_active) throw conflict('The selected pharmacy is not available.');
    if (!input.items?.length) throw badRequest('Your cart is empty.');

    const delivery = resolveDelivery(input.pharmacyId, input);
    const items = input.items.map((item) => {
      const medicine = catalogueRepo.getMedicine(item.medicineId);
      const pm = catalogueRepo.getPharmacyMedicine(input.pharmacyId, item.medicineId);
      if (!medicine || !medicine.is_active || !pm || !pm.is_active) {
        throw conflict('One of the medicines is no longer sold by this pharmacy.');
      }
      if (availableStock(input.pharmacyId, item.medicineId) < item.quantity) {
        throw conflict('Not enough stock available for one of the items.', [
          { medicineId: item.medicineId, requested: item.quantity },
        ]);
      }
      return {
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice: pm.price,
        name: `${medicine.brand_name}${medicine.strength ? ` ${medicine.strength}` : ''}`,
        requiresPrescription: Boolean(medicine.requires_prescription),
      };
    });

    const subtotal = roundMoney(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    const total = roundMoney(subtotal + delivery.deliveryFee);
    const requiresPrescription = items.some((item) => item.requiresPrescription);
    const status = requiresPrescription ? 'awaiting_prescription' : 'placed';
    const paymentStatus = input.paymentMethod === 'cash' ? 'cash_on_pickup' : 'pending';

    let reference = orderReference();
    while (ordersRepo.findByReference(reference)) reference = orderReference();

    const orderId = ordersRepo.createOrder({
      reference,
      customerId: null,
      guestName: input.name.trim(),
      guestPhone,
      guestEmail: input.email?.trim() || null,
      consentGivenAt: new Date().toISOString(),
      pharmacyId: input.pharmacyId,
      channel: 'online',
      fulfilment: input.fulfilment,
      deliveryZoneId: delivery.zoneId,
      deliveryFee: delivery.deliveryFee,
      deliveryAddress: delivery.deliveryAddress,
      digitalAddressCode: delivery.digitalAddressCode,
      status,
      paymentStatus,
      subtotal,
      total,
      notes: input.notes || null,
      createdBy: null,
    });

    for (const item of items) {
      const allocations = allocateFefo(input.pharmacyId, item.medicineId, item.quantity);
      const orderItemId = ordersRepo.addItem(orderId, item);
      for (const allocation of allocations) {
        ordersRepo.addAllocation(orderItemId, allocation.batchId, allocation.quantity);
      }
    }

    if (input.paymentMethod === 'cash') createCashPayment(orderId, total);
    else createPendingMomoPayment(orderId, total, input.network, momoPhone);

    if (input.fulfilment === 'delivery') deliveryRepo.createDelivery(orderId);
    ordersRepo.addEvent(
      orderId,
      status,
      requiresPrescription
        ? 'Guest order placed. Waiting for a prescription so a pharmacist can verify it.'
        : 'Guest order placed without an account.'
    );
    recordAudit({
      userId: null,
      action: 'guest_order_placed',
      entity: 'order',
      entityId: orderId,
      after: { reference, total, payment_method: input.paymentMethod, phone: maskPhone(guestPhone) },
      ip,
    });
    return { orderId, reference, paymentMethod: input.paymentMethod, total, phone: momoPhone, network: input.network };
  });

  if (result.paymentMethod === 'momo') {
    await initiateMomoPayment(result.orderId, result.phone, result.network);
  }

  const order = ordersRepo.detail(result.orderId);
  const message =
    order.status === 'awaiting_prescription'
      ? `Order ${order.reference} received. Upload your prescription so a pharmacist can verify it before release.`
      : `Order ${order.reference} received by ${order.pharmacy_name}. Total GHS ${order.total.toFixed(2)}.`;
  notifyOrderRecipient(
    { customer_id: null, guest_phone: order.guest_phone, guest_email: order.guest_email },
    'order_confirmation',
    message,
    { orderId: order.id }
  ).catch(() => {});
  return publicOrder(order);
}

const TRANSITIONS = {
  placed: ['verified', 'cancelled'],
  awaiting_prescription: ['cancelled'],
  verified: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'completed', 'cancelled'],
  out_for_delivery: ['completed', 'ready', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function updateOrderStatus(orderId, target, user, note) {
  const raw = ordersRepo.findRaw(orderId);
  if (!raw) throw notFound('Order not found.');
  if (!ordersRepo.canUserAccessOrder(raw, user) || !['pharmacist', 'admin'].includes(user.role)) {
    throw forbidden();
  }
  if (raw.status === target) return getOrder(orderId, user);
  if (!TRANSITIONS[raw.status]?.includes(target)) {
    throw conflict(`An order that is "${raw.status.replace(/_/g, ' ')}" cannot move to "${target.replace(/_/g, ' ')}".`);
  }
  if (target === 'verified') {
    if (ordersRepo.pendingPrescriptionCount(orderId) > 0) {
      throw conflict('A pending prescription must be reviewed before this order can be verified.');
    }
    if (raw.payment_status === 'pending') throw conflict('Mobile money payment has not been confirmed yet.');
    if (ordersRepo.hasPomItems(orderId)) {
      const approved = getDb()
        .prepare("SELECT COUNT(*) AS c FROM prescriptions WHERE order_id = ? AND status = 'approved'")
        .get(orderId).c;
      if (approved === 0) throw conflict('Prescription-only items cannot be released without an approved prescription.');
    }
  }

  if (target === 'cancelled') return cancelOrder(orderId, user, note || 'Cancelled by staff');

  const deliveryRow = deliveryRepo.getDelivery(orderId);
  if (target === 'out_for_delivery') {
    if (raw.fulfilment !== 'delivery') throw conflict('Only delivery orders can be dispatched.');
    if (!deliveryRow?.rider_id) throw conflict('Assign a rider before dispatching this order.');
  }

  const status = immediateTransaction(() => {
    const updated = ordersRepo.updateStatus(orderId, target);
    if (target === 'out_for_delivery' && deliveryRow) deliveryRepo.updateDeliveryStatus(orderId, 'out_for_delivery');
    if (target === 'completed' && deliveryRow) deliveryRepo.updateDeliveryStatus(orderId, 'delivered');
    ordersRepo.addEvent(orderId, target, note || null, user.id);
    recordAudit({
      userId: user.id,
      action: 'order_status_changed',
      entity: 'order',
      entityId: orderId,
      before: { status: raw.status },
      after: { status: target },
    });
    return updated;
  });

  const messages = {
    verified: `Order ${raw.reference} was verified by the pharmacy.`,
    ready: `Order ${raw.reference} is ready for pickup.`,
    out_for_delivery: `Order ${raw.reference} is out for delivery.`,
    completed: `Order ${raw.reference} is complete. Thank you for choosing ${raw.pharmacy_name || 'your pharmacy'}.`,
  };
  if (messages[target]) {
    notifyOrderRecipient(raw, `order_${target}`, messages[target], { orderId }).catch(() => {});
  }
  return getOrder(orderId, user);
}

export function cancelOrder(orderId, user, reason) {
  const raw = ordersRepo.findRaw(orderId);
  if (!raw) throw notFound('Order not found.');
  if (!ordersRepo.canUserAccessOrder(raw, user)) throw forbidden();
  if (raw.status === 'cancelled') return getOrder(orderId, user);
  if (raw.status === 'completed') throw conflict('A completed order cannot be cancelled.');
  if (user.role === 'customer' && !['placed', 'awaiting_prescription'].includes(raw.status)) {
    throw conflict('This order can no longer be cancelled online. Please contact the pharmacy.');
  }
  immediateTransaction(() => {
    const restored = restoreOrderStock(orderId);
    const adjust = getDb().prepare(
      'INSERT INTO stock_adjustments (batch_id, delta, reason, user_id) VALUES (?, ?, ?, ?)'
    );
    for (const row of restored) adjust.run(row.batch_id, row.quantity, `Order ${raw.reference} cancelled`, user.id);
    ordersRepo.updateStatus(orderId, 'cancelled', raw.payment_status === 'pending' ? 'failed' : raw.payment_status);
    ordersRepo.addEvent(orderId, 'cancelled', reason || 'Cancelled', user.id);
    const delivery = deliveryRepo.getDelivery(orderId);
    if (delivery) deliveryRepo.updateDeliveryStatus(orderId, 'failed', reason || 'Order cancelled');
    recordAudit({
      userId: user.id,
      action: 'order_cancelled',
      entity: 'order',
      entityId: orderId,
      before: { status: raw.status },
      after: { status: 'cancelled', reason },
    });
  });
  notifyOrderRecipient(raw, 'order_cancelled', `Order ${raw.reference} was cancelled. ${reason || ''}`.trim(), {
    orderId,
  }).catch(() => {});
  return getOrder(orderId, user);
}

export function reorder(orderId, user) {
  const original = getOrder(orderId, user);
  if (user.role !== 'customer' || original.customer_id !== user.id) throw forbidden();
  const plan = [];
  const unavailable = [];
  for (const item of original.items) {
    const pm = catalogueRepo.getPharmacyMedicine(original.pharmacy_id, item.medicine_id);
    const stock = pm && pm.is_active ? availableStock(original.pharmacy_id, item.medicine_id) : 0;
    if (!pm || !pm.is_active || stock <= 0) {
      unavailable.push({ medicine_id: item.medicine_id, name: item.medicine_name_snapshot, reason: 'Out of stock' });
      continue;
    }
    plan.push({ medicineId: item.medicine_id, quantity: Math.min(item.quantity, stock, 50), price: pm.price });
  }
  if (!plan.length) throw conflict('None of the items from that order are currently in stock.');
  immediateTransaction(() => {
    const cart = cartRepo.getOrCreateCart(user.id);
    cartRepo.clearCart(cart.id);
    cartRepo.setPharmacy(cart.id, original.pharmacy_id);
    for (const item of plan) cartRepo.upsertItem(cart.id, item.medicineId, item.quantity);
  });
  recordAudit({
    userId: user.id,
    action: 'order_reorder',
    entity: 'order',
    entityId: orderId,
    after: { items: plan.length, unavailable: unavailable.length },
  });
  return { cart: cartRepo.getCart(user.id), unavailable, message: 'Available items were re-validated and added to your cart.' };
}

export function createWalkInSale(user, input) {
  if (!['pharmacist', 'admin'].includes(user.role)) throw forbidden();
  const pharmacyId = user.role === 'admin' ? input.pharmacyId : user.pharmacy_id;
  if (!pharmacyId) throw badRequest('A pharmacy is required.');
  if (!input.items?.length) throw badRequest('Add at least one item to the sale.');

  const orderId = immediateTransaction(() => {
    const prepared = input.items.map((item) => {
      const medicine = catalogueRepo.getMedicine(item.medicineId);
      const pm = catalogueRepo.getPharmacyMedicine(pharmacyId, item.medicineId);
      if (!medicine || !pm || !pm.is_active) throw notFound('One of the medicines is not sold by this pharmacy.');
      return {
        medicineId: item.medicineId,
        quantity: item.quantity,
        unitPrice: pm.price,
        name: `${medicine.brand_name}${medicine.strength ? ` ${medicine.strength}` : ''}`,
        requiresPrescription: medicine.requires_prescription,
      };
    });
    const subtotal = roundMoney(prepared.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0));
    let reference = orderReference();
    while (ordersRepo.findByReference(reference)) reference = orderReference();
    const newOrderId = ordersRepo.createOrder({
      reference,
      customerId: null,
      guestName: null,
      guestPhone: null,
      guestEmail: null,
      consentGivenAt: null,
      pharmacyId,
      channel: 'walk_in',
      fulfilment: 'pickup',
      deliveryZoneId: null,
      deliveryFee: 0,
      deliveryAddress: null,
      digitalAddressCode: null,
      status: 'completed',
      paymentStatus: 'success',
      subtotal,
      total: subtotal,
      notes: input.notes || 'Walk-in counter sale',
      createdBy: user.id,
    });
    for (const item of prepared) {
      const allocations = allocateFefo(pharmacyId, item.medicineId, item.quantity);
      const orderItemId = ordersRepo.addItem(newOrderId, item);
      for (const allocation of allocations) {
        ordersRepo.addAllocation(orderItemId, allocation.batchId, allocation.quantity);
      }
    }
    createCashPayment(newOrderId, subtotal);
    ordersRepo.addEvent(newOrderId, 'placed', 'Walk-in sale recorded at the counter', user.id);
    ordersRepo.addEvent(newOrderId, 'completed', 'Paid and collected at the counter', user.id);
    recordAudit({
      userId: user.id,
      action: 'walkin_sale',
      entity: 'order',
      entityId: newOrderId,
      after: { reference, total: subtotal },
    });
    return newOrderId;
  });
  return getOrder(orderId, user);
}
