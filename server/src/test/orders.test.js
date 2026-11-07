import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient, setStock, stockOf, TINY_PNG } from './helpers.js';

const app = createApp();
let ids;
let customer;
let customerB;
let pharmacist;
let pharmacistB;
let admin;

beforeEach(async () => {
  resetDb();
  ids = seedBase();

  customer = await makeClient(app);
  await customer.login('+233240000101');
  customerB = await makeClient(app);
  await customerB.login('+233240000102');
  pharmacist = await makeClient(app);
  await pharmacist.login('+233240000103');
  pharmacistB = await makeClient(app);
  await pharmacistB.login('+233240000104');
  admin = await makeClient(app);
  await admin.login('+233240000100');
});

async function addToCart(client, medicineId = ids.medicineOtc, quantity = 1) {
  return client.post('/api/cart/items', { medicineId, quantity, pharmacyId: ids.pharmacyA });
}

describe('cart', () => {
  it('adds items, enforces one pharmacy and caps quantity at available stock', async () => {
    const added = await addToCart(customer, ids.medicineOtc, 3);
    expect(added.status).toBe(200);
    expect(added.body.cart.item_count).toBe(3);
    expect(added.body.cart.subtotal).toBe(16.5);
    expect(added.body.cart.pharmacy.id).toBe(ids.pharmacyA);

    const otherPharmacy = await customer.post('/api/cart/items', {
      medicineId: ids.medicineOtc,
      quantity: 1,
      pharmacyId: ids.pharmacyB,
    });
    expect(otherPharmacy.status).toBe(409);
    expect(otherPharmacy.body.error.details.cart_pharmacy_id).toBe(ids.pharmacyA);

    const tooMany = await addToCart(customer, ids.medicineOtc, 40);
    expect(tooMany.status).toBe(409);
    expect(tooMany.body.error.details.available).toBe(30);
  });

  it('only allows customers to use the cart', async () => {
    const response = await pharmacist.get('/api/cart');
    expect(response.status).toBe(403);
  });
});

describe('cash order lifecycle', () => {
  it('places a pickup order, allocates FEFO stock and restores it on cancellation', async () => {
    await addToCart(customer, ids.medicineOtc, 25);
    const placed = await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    expect(placed.status).toBe(201);
    const order = placed.body.order;
    expect(order).toMatchObject({
      status: 'placed',
      payment_status: 'cash_on_pickup',
      fulfilment: 'pickup',
      subtotal: 137.5,
      total: 137.5,
    });
    expect(order.payments[0]).toMatchObject({ method: 'cash', status: 'success', amount: 137.5 });
    expect(order.items[0].allocated).toBe(25);
    expect(order.events.length).toBeGreaterThanOrEqual(1);

    expect(stockOf(ids.batches.soon)).toBe(0);
    expect(stockOf(ids.batches.later)).toBe(5);
    expect(stockOf(ids.batches.expired)).toBe(50);
    expect((await customer.get('/api/cart')).body.cart.item_count).toBe(0);

    const timeline = await customer.get(`/api/orders/${order.id}/timeline`);
    expect(timeline.status).toBe(200);
    expect(timeline.body.events[0].status).toBe('placed');

    const receipt = await customer.get(`/api/orders/${order.id}/receipt`);
    expect(receipt.status).toBe(200);
    expect(receipt.headers['content-type']).toContain('application/pdf');

    const cancelled = await customer.post(`/api/orders/${order.id}/cancel`, { reason: 'Changed my mind' });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.order.status).toBe('cancelled');
    expect(stockOf(ids.batches.soon)).toBe(20);
    expect(stockOf(ids.batches.later)).toBe(10);

    const adjustments = getDb().prepare('SELECT * FROM stock_adjustments').all();
    expect(adjustments).toHaveLength(2);
    expect(adjustments.reduce((sum, row) => sum + row.delta, 0)).toBe(25);
    expect(adjustments.every((row) => /cancelled/i.test(row.reason))).toBe(true);
  });

  it('requires a delivery address, digital address and a zone belonging to the pharmacy', async () => {
    await addToCart(customerB, ids.medicineOtc, 2);
    const missingAddress = await customerB.post('/api/orders', {
      fulfilment: 'delivery',
      deliveryZoneId: ids.zoneA,
      paymentMethod: 'cash',
    });
    expect(missingAddress.status).toBe(400);
    expect(missingAddress.body.error.message).toMatch(/delivery address/i);

    await addToCart(customer, ids.medicineOtc, 2);
    const badDigital = await customer.post('/api/orders', {
      fulfilment: 'delivery',
      deliveryZoneId: ids.zoneA,
      deliveryAddress: 'House 4',
      digitalAddressCode: 'ABC',
      paymentMethod: 'cash',
    });
    expect(badDigital.status).toBe(400);
    expect(badDigital.body.error.details.some((d) => d.path === 'digitalAddressCode')).toBe(true);

    const wrongZone = await customer.post('/api/orders', {
      fulfilment: 'delivery',
      deliveryZoneId: ids.zoneB,
      deliveryAddress: 'House 4',
      digitalAddressCode: 'GD-123-4567',
      paymentMethod: 'cash',
    });
    expect(wrongZone.status).toBe(400);
  });

  it('adds the zone fee to a delivery order and creates a delivery record', async () => {
    await addToCart(customer, ids.medicineOtc, 2);
    const placed = await customer.post('/api/orders', {
      fulfilment: 'delivery',
      deliveryZoneId: ids.zoneA,
      deliveryAddress: 'House 4, Doryumu',
      digitalAddressCode: 'GD-123-4567',
      paymentMethod: 'cash',
      notes: 'Call on arrival',
    });
    expect(placed.status).toBe(201);
    expect(placed.body.order.delivery_fee).toBe(5);
    expect(placed.body.order.total).toBe(16);
    expect(placed.body.order.digital_address_code).toBe('GD-123-4567');
    expect(placed.body.order.delivery).toMatchObject({ status: 'assigned' });
  });

  it('cannot sell the last unit twice', async () => {
    setStock(ids.batches.soon, 1);
    setStock(ids.batches.later, 0);

    await addToCart(customer, ids.medicineOtc, 1);
    await addToCart(customerB, ids.medicineOtc, 1);

    const first = await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    expect(first.status).toBe(201);
    const second = await customerB.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    expect(second.status).toBe(409);
    expect(second.body.error.message).toMatch(/Not enough stock/);
    expect(stockOf(ids.batches.soon)).toBe(0);
  });
});

describe('mobile money payment', () => {
  it('starts pending and moves to success after verification', async () => {
    await addToCart(customer, ids.medicineOtc, 1);
    const placed = await customer.post('/api/orders', {
      fulfilment: 'pickup',
      paymentMethod: 'momo',
      network: 'MTN',
      phone: '024 000 0101',
    });
    expect(placed.status).toBe(201);
    const order = placed.body.order;
    expect(order.payment_status).toBe('pending');
    expect(order.payments[0].status).toBe('pending');
    expect(order.payments[0].reference).toMatch(/^MOCK-/);

    const paymentId = order.payments[0].id;
    const verified = await customer.post(`/api/payments/${paymentId}/verify`);
    expect(verified.status).toBe(200);
    expect(verified.body.payment.status).toBe('success');
    expect(verified.body.payment_status).toBe('success');
    expect(verified.body.order_status).toBe('placed');

    const listed = await customer.get(`/api/payments/order/${order.id}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items[0].status).toBe('success');
  });

  it('requires a network and a valid mobile money phone number', async () => {
    await addToCart(customer, ids.medicineOtc, 1);
    const noNetwork = await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'momo' });
    expect(noNetwork.status).toBe(400);
    const badPhone = await customer.post('/api/orders', {
      fulfilment: 'pickup',
      paymentMethod: 'momo',
      network: 'MTN',
      phone: '12345',
    });
    expect(badPhone.status).toBe(400);
  });
});

describe('prescription-only medicines', () => {
  async function placePomOrder() {
    await addToCart(customer, ids.medicinePom, 2);
    return customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
  }

  it('holds a POM order until a pharmacist approves the prescription', async () => {
    const placed = await placePomOrder();
    expect(placed.status).toBe(201);
    const order = placed.body.order;
    expect(order.status).toBe('awaiting_prescription');

    const blocked = await pharmacist.patch(`/api/orders/${order.id}/status`, { status: 'verified' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/cannot move to/i);
    expect((await customer.get(`/api/orders/${order.id}`)).body.order.status).toBe('awaiting_prescription');

    const uploaded = await customer.upload(`/api/orders/${order.id}/prescriptions`, TINY_PNG, 'script.png');
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.prescription.status).toBe('pending');
    const prescriptionId = uploaded.body.prescription.id;

    const duplicate = await customer.upload(`/api/orders/${order.id}/prescriptions`, TINY_PNG, 'again.png');
    expect(duplicate.status).toBe(409);

    const otherQueue = await pharmacistB.get('/api/prescriptions?status=pending');
    expect(otherQueue.body.items).toHaveLength(0);
    const queue = await pharmacist.get('/api/prescriptions?status=pending');
    expect(queue.body.items).toHaveLength(1);
    expect(queue.body.items[0].pom_items).toContain('Amoxil');

    expect((await customerB.get(`/api/prescriptions/${prescriptionId}/file`)).status).toBe(403);
    expect((await pharmacistB.get(`/api/prescriptions/${prescriptionId}/file`)).status).toBe(403);
    const own = await customer.get(`/api/prescriptions/${prescriptionId}/file`);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toContain('image/webp');

    const approved = await pharmacist.patch(`/api/prescriptions/${prescriptionId}/review`, { status: 'approved' });
    expect(approved.status).toBe(200);
    const refreshed = await customer.get(`/api/orders/${order.id}`);
    expect(refreshed.body.order.status).toBe('verified');

    expect((await customerB.get(`/api/orders/${order.id}`)).status).toBe(403);
    expect((await pharmacist.get(`/api/orders/${order.id}`)).status).toBe(200);
    expect((await admin.get(`/api/orders/${order.id}`)).status).toBe(200);

    const lateCancel = await customer.post(`/api/orders/${order.id}/cancel`, {});
    expect(lateCancel.status).toBe(409);
    const staffCancel = await pharmacist.post(`/api/orders/${order.id}/cancel`, { reason: 'Out of stock after review' });
    expect(staffCancel.status).toBe(200);
    expect(stockOf(ids.batches.pom)).toBe(10);
  });

  it('rejects a prescription for an order without POM items', async () => {
    await addToCart(customer, ids.medicineOtc, 1);
    const placed = await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    const uploaded = await customer.upload(`/api/orders/${placed.body.order.id}/prescriptions`, TINY_PNG);
    expect(uploaded.status).toBe(400);
    expect(uploaded.body.error.message).toMatch(/prescription-only/);
  });

  it('requires remarks when querying or rejecting a prescription', async () => {
    const placed = await placePomOrder();
    const uploaded = await customer.upload(`/api/orders/${placed.body.order.id}/prescriptions`, TINY_PNG);
    const id = uploaded.body.prescription.id;
    const queried = await pharmacist.patch(`/api/prescriptions/${id}/review`, { status: 'queried' });
    expect(queried.status).toBe(400);
    const rejected = await pharmacist.patch(`/api/prescriptions/${id}/review`, {
      status: 'rejected',
      remarks: 'Illegible',
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body.prescription.status).toBe('rejected');
  });
});

describe('reorder and walk-in sales', () => {
  it('revalidates stock and refills the cart from a past order', async () => {
    await addToCart(customer, ids.medicineOtc, 2);
    const placed = await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    const result = await customer.post(`/api/orders/${placed.body.order.id}/reorder`);
    expect(result.status).toBe(200);
    expect(result.body.cart.items).toHaveLength(1);
    expect(result.body.cart.items[0].quantity).toBe(2);
    expect(result.body.unavailable).toHaveLength(0);
  });

  it('reports unavailable items when everything is out of stock', async () => {
    await addToCart(customer, ids.medicineOtc, 2);
    const placed = await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    setStock(ids.batches.soon, 0);
    setStock(ids.batches.later, 0);
    const result = await customer.post(`/api/orders/${placed.body.order.id}/reorder`);
    expect(result.status).toBe(409);
  });

  it('records a completed walk-in sale with cash payment', async () => {
    const sale = await pharmacist.post('/api/orders/walk-in', {
      items: [{ medicineId: ids.medicineOtc, quantity: 2 }],
      notes: 'Counter sale',
    });
    expect(sale.status).toBe(201);
    const order = sale.body.order;
    expect(order).toMatchObject({
      channel: 'walk_in',
      status: 'completed',
      payment_status: 'success',
      customer_id: null,
      total: 11,
    });
    expect(order.payments[0].method).toBe('cash');
    expect(stockOf(ids.batches.soon)).toBe(18);

    expect((await customer.post('/api/orders/walk-in', { items: [{ medicineId: 1, quantity: 1 }] })).status).toBe(403);
  });

  it('scopes order lists by role', async () => {
    await addToCart(customer, ids.medicineOtc, 1);
    await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    await addToCart(customerB, ids.medicineOtc, 1);
    await customerB.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });

    const own = await customer.get('/api/orders');
    expect(own.body.items).toHaveLength(1);
    const pharmacyOrders = await pharmacist.get('/api/orders');
    expect(pharmacyOrders.body.items).toHaveLength(2);
    const all = await admin.get('/api/orders');
    expect(all.body.items).toHaveLength(2);
    expect((await pharmacistB.get('/api/orders')).body.items).toHaveLength(0);
  });
});
