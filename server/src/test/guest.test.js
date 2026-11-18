import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient, setStock, stockOf, TINY_PNG } from './helpers.js';

const app = createApp();
let ids;
let guest;
let otherGuest;
let pharmacist;
let pharmacistB;

const GUEST = {
  name: 'Adjoa Guest',
  phone: '0244000111',
  email: '',
  fulfilment: 'pickup',
  paymentMethod: 'cash',
  consent: true,
};

beforeEach(async () => {
  resetDb();
  ids = seedBase();
  guest = await makeClient(app);
  otherGuest = await makeClient(app);
  pharmacist = await makeClient(app);
  await pharmacist.login('+233240000103');
  pharmacistB = await makeClient(app);
  await pharmacistB.login('+233240000104');
});

function placeGuest(client, overrides = {}) {
  return client.post('/api/guest/orders', {
    ...GUEST,
    pharmacyId: ids.pharmacyA,
    items: [{ medicineId: ids.medicineOtc, quantity: 2 }],
    ...overrides,
  });
}

function uploadGuestPrescription(client, orderId, reference, phone, buffer = TINY_PNG) {
  return client.agent
    .post(`/api/guest/orders/${orderId}/prescription`)
    .set('X-CSRF-Token', client.csrfToken)
    .field('reference', reference)
    .field('phone', phone)
    .attach('file', buffer, 'prescription.png');
}

describe('guest order placement', () => {
  it('places a pickup order without an account, records consent and deducts FEFO stock', async () => {
    const response = await placeGuest(guest);
    expect(response.status).toBe(201);
    const order = response.body.order;
    expect(order.reference).toMatch(/^PH-/);
    expect(order.status).toBe('placed');
    expect(order.payment_status).toBe('cash_on_pickup');
    expect(order.total).toBe(11);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({ quantity: 2, unit_price: 5.5 });
    expect(order).not.toHaveProperty('guest_phone');
    expect(order).not.toHaveProperty('customer_phone');

    const row = getDb().prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    expect(row.customer_id).toBeNull();
    expect(row.guest_name).toBe('Adjoa Guest');
    expect(row.guest_phone).toBe('+233244000111');
    expect(row.consent_given_at).toBeTruthy();

    // FEFO: the batch expiring soonest is consumed first.
    expect(stockOf(ids.batches.soon)).toBe(18);
    expect(stockOf(ids.batches.later)).toBe(10);
    expect(stockOf(ids.batches.expired)).toBe(50);

    const payment = getDb().prepare('SELECT * FROM payments WHERE order_id = ?').get(order.id);
    expect(payment).toMatchObject({ method: 'cash', status: 'success', amount: 11 });

    const notifications = getDb()
      .prepare("SELECT * FROM notifications WHERE order_id = ? AND channel = 'sms'")
      .all(order.id);
    expect(notifications[0]?.recipient).toBe('+233244000111');
  });

  it('requires consent, a valid phone and a delivery zone from the chosen pharmacy', async () => {
    const noConsent = await placeGuest(guest, { consent: false });
    expect(noConsent.status).toBe(400);

    const badPhone = await placeGuest(guest, { phone: '12345' });
    expect(badPhone.status).toBe(400);

    const wrongZone = await placeGuest(guest, {
      fulfilment: 'delivery',
      deliveryZoneId: ids.zoneB,
      deliveryAddress: 'House 1',
      digitalAddressCode: 'GD-123-4567',
    });
    expect(wrongZone.status).toBe(400);

    expect(getDb().prepare('SELECT COUNT(*) AS c FROM orders').get().c).toBe(0);
  });

  it('adds the delivery fee and creates a rider delivery for a guest order', async () => {
    const response = await placeGuest(guest, {
      fulfilment: 'delivery',
      deliveryZoneId: ids.zoneA,
      deliveryAddress: 'House 7, Doryumu',
      digitalAddressCode: 'GD-123-4567',
    });
    expect(response.status).toBe(201);
    expect(response.body.order.delivery_fee).toBe(5);
    expect(response.body.order.total).toBe(16);
    expect(response.body.order.delivery_address).toBe('House 7, Doryumu');
    const delivery = getDb().prepare('SELECT * FROM deliveries WHERE order_id = ?').get(response.body.order.id);
    expect(delivery).toBeTruthy();
  });

  it('cannot sell the last unit twice to two guests', async () => {
    setStock(ids.batches.soon, 1);
    setStock(ids.batches.later, 0);

    const [first, second] = await Promise.all([
      placeGuest(guest, { items: [{ medicineId: ids.medicineOtc, quantity: 1 }] }),
      placeGuest(otherGuest, {
        name: 'Another Guest',
        phone: '0244000112',
        items: [{ medicineId: ids.medicineOtc, quantity: 1 }],
      }),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(stockOf(ids.batches.soon)).toBe(0);
  });

  it('shows guest orders to pharmacy staff with the guest name and phone', async () => {
    const response = await placeGuest(guest);
    const list = await pharmacist.get('/api/orders');
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      reference: response.body.order.reference,
      customer_name: 'Adjoa Guest',
      customer_phone: '+233244000111',
      is_guest: 1,
    });

    const detail = await pharmacist.get(`/api/orders/${response.body.order.id}`);
    expect(detail.body.order.customer_name).toBe('Adjoa Guest');
    expect(detail.body.order.customer_phone).toBe('+233244000111');

    const search = await pharmacist.get('/api/orders?q=Adjoa');
    expect(search.body.items).toHaveLength(1);

    const other = await pharmacistB.get('/api/orders');
    expect(other.body.items).toHaveLength(0);
  });
});

describe('guest prescription upload', () => {
  async function placePomOrder() {
    const response = await placeGuest(guest, {
      items: [{ medicineId: ids.medicinePom, quantity: 1 }],
    });
    expect(response.status).toBe(201);
    return response.body.order;
  }

  it('accepts an upload only with the matching reference and phone', async () => {
    const order = await placePomOrder();
    expect(order.status).toBe('awaiting_prescription');

    const wrongPhone = await uploadGuestPrescription(guest, order.id, order.reference, '0244000999');
    expect(wrongPhone.status).toBe(404);
    expect(wrongPhone.body.error.message).toMatch(/could not find an order/i);

    const wrongReference = await uploadGuestPrescription(guest, order.id, 'PH-00000000-XXXX', GUEST.phone);
    expect(wrongReference.status).toBe(404);
    expect(wrongReference.body.error.message).toBe(wrongPhone.body.error.message);

    const uploaded = await uploadGuestPrescription(guest, order.id, order.reference, GUEST.phone);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.prescription.status).toBe('pending');

    const duplicate = await uploadGuestPrescription(guest, order.id, order.reference, GUEST.phone);
    expect(duplicate.status).toBe(409);
  });

  it('queues the guest prescription for the pharmacy and keeps the file private', async () => {
    const order = await placePomOrder();
    const uploaded = await uploadGuestPrescription(guest, order.id, order.reference, GUEST.phone);
    const prescriptionId = uploaded.body.prescription.id;

    const queue = await pharmacist.get('/api/prescriptions?status=pending');
    expect(queue.status).toBe(200);
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0]).toMatchObject({
      customer_name: 'Adjoa Guest',
      customer_phone: '+233244000111',
      is_guest: 1,
      order_id: order.id,
    });
    expect((await pharmacistB.get('/api/prescriptions?status=pending')).body.items).toHaveLength(0);

    // No public route exposes prescription files.
    expect((await guest.get(`/api/prescriptions/${prescriptionId}/file`)).status).toBe(401);
    expect((await pharmacistB.get(`/api/prescriptions/${prescriptionId}/file`)).status).toBe(403);
    const ownPharmacy = await pharmacist.get(`/api/prescriptions/${prescriptionId}/file`);
    expect(ownPharmacy.status).toBe(200);
    expect(ownPharmacy.headers['content-type']).toContain('image/webp');
  });

  it('allows a new upload after the pharmacist queries the prescription', async () => {
    const order = await placePomOrder();
    const first = await uploadGuestPrescription(guest, order.id, order.reference, GUEST.phone);
    const queried = await pharmacist.patch(`/api/prescriptions/${first.body.prescription.id}/review`, {
      status: 'queried',
      remarks: 'Please upload the full page.',
    });
    expect(queried.status).toBe(200);

    const second = await uploadGuestPrescription(guest, order.id, order.reference, GUEST.phone);
    expect(second.status).toBe(201);
    const track = await guest.post('/api/orders/track', { reference: order.reference, phone: GUEST.phone });
    expect(track.status).toBe(200);
    expect(track.body.order.prescriptions[0].status).toBe('pending');
    const queriedCopy = track.body.order.prescriptions.find((item) => item.status === 'queried');
    expect(queriedCopy.remarks).toMatch(/full page/);
  });
});

describe('guest order tracking', () => {
  it('returns the order only when reference and phone both match', async () => {
    const placed = await placeGuest(guest);
    const order = placed.body.order;

    const tracked = await guest.post('/api/orders/track', { reference: order.reference, phone: '024 400 0111' });
    expect(tracked.status).toBe(200);
    expect(tracked.body.order).toMatchObject({
      reference: order.reference,
      status: 'placed',
      total: 11,
      pharmacy: { name: 'Doryumu Community Pharmacy', community: 'Doryumu' },
    });
    expect(tracked.body.order.items[0].brand_name).toBe('Paracetamol');
    expect(tracked.body.order).not.toHaveProperty('customer_name');
    expect(tracked.body.order).not.toHaveProperty('guest_phone');
    expect(JSON.stringify(tracked.body)).not.toMatch(/customer_phone|guest_phone|file_path/);

    const wrongPhone = await guest.post('/api/orders/track', {
      reference: order.reference,
      phone: '0244000999',
    });
    expect(wrongPhone.status).toBe(404);

    const unknown = await guest.post('/api/orders/track', {
      reference: 'PH-00000000-XXXX',
      phone: '0244000111',
    });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.message).toBe(wrongPhone.body.error.message);
  });

  it('does not let one guest read another guest order with a swapped phone', async () => {
    const first = await placeGuest(guest);
    const second = await placeGuest(otherGuest, {
      name: 'Another Guest',
      phone: '0244000112',
      items: [{ medicineId: ids.medicineOtc, quantity: 1 }],
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const swapped = await otherGuest.post('/api/orders/track', {
      reference: first.body.order.reference,
      phone: '0244000112',
    });
    expect(swapped.status).toBe(404);

    // Account-protected order endpoints stay private.
    expect((await guest.get(`/api/orders/${first.body.order.id}`)).status).toBe(401);
    expect((await guest.get(`/api/orders/${first.body.order.id}/receipt`)).status).toBe(401);
  });

  it('does not expose account orders through the public track endpoint', async () => {
    const customer = await makeClient(app);
    await customer.login('+233240000101');
    await customer.post('/api/cart/items', {
      medicineId: ids.medicineOtc,
      quantity: 1,
      pharmacyId: ids.pharmacyA,
    });
    const placed = await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    expect(placed.status).toBe(201);

    const tracked = await guest.post('/api/orders/track', {
      reference: placed.body.order.reference,
      phone: '+233240000101',
    });
    expect(tracked.status).toBe(404);
  });
});
