import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient } from './helpers.js';

const app = createApp();
let ids;
let customer;
let pharmacistA;
let pharmacistB;
let riderA;
let riderB;

beforeEach(async () => {
  resetDb();
  ids = seedBase();
  customer = await makeClient(app);
  await customer.login('+233240000101');
  pharmacistA = await makeClient(app);
  await pharmacistA.login('+233240000103');
  pharmacistB = await makeClient(app);
  await pharmacistB.login('+233240000104');
  riderA = await makeClient(app);
  await riderA.login('+233240000105');
  riderB = await makeClient(app);
  await riderB.login('+233240000106');
});

async function placeDeliveryOrder() {
  await customer.post('/api/cart/items', {
    medicineId: ids.medicineOtc,
    quantity: 2,
    pharmacyId: ids.pharmacyA,
  });
  const placed = await customer.post('/api/orders', {
    fulfilment: 'delivery',
    deliveryZoneId: ids.zoneA,
    deliveryAddress: 'House 4, Doryumu',
    digitalAddressCode: 'GD-123-4567',
    paymentMethod: 'cash',
  });
  return placed.body.order;
}

describe('delivery zones', () => {
  it('exposes active zones publicly per pharmacy', async () => {
    const anonymous = await makeClient(app);
    const response = await anonymous.get(`/api/pharmacies/${ids.pharmacyA}/delivery-zones`);
    expect(response.status).toBe(200);
    expect(response.body.items.map((zone) => zone.name)).toEqual(['Doryumu centre']);
  });

  it('lets staff manage zones but protects zones already used by orders', async () => {
    const created = await pharmacistA.post('/api/delivery-zones', {
      name: 'Doryumu outskirts',
      fee: 8,
      rules: '4-6 km',
    });
    expect(created.status).toBe(201);
    const zone = created.body.zone;

    const updated = await pharmacistA.patch(`/api/delivery-zones/${zone.id}`, {
      name: 'Doryumu outskirts',
      fee: 9,
      isActive: false,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.zone.fee).toBe(9);
    expect(updated.body.zone.is_active).toBe(0);

    expect((await pharmacistA.del(`/api/delivery-zones/${zone.id}`)).status).toBe(204);

    await placeDeliveryOrder();
    const inUse = await pharmacistA.del(`/api/delivery-zones/${ids.zoneA}`);
    expect(inUse.status).toBe(409);
  });
});

describe('rider assignment and delivery progression', () => {
  it('assigns a rider from the same pharmacy and completes the delivery', async () => {
    const order = await placeDeliveryOrder();
    expect(order.status).toBe('placed');

    const riders = await pharmacistA.get('/api/riders');
    expect(riders.body.items.map((r) => r.id)).toEqual([ids.riderA]);

    const wrongPharmacy = await pharmacistA.post(`/api/orders/${order.id}/assign-rider`, { riderId: ids.riderB });
    expect(wrongPharmacy.status).toBe(400);

    const assigned = await pharmacistA.post(`/api/orders/${order.id}/assign-rider`, { riderId: ids.riderA });
    expect(assigned.status).toBe(200);
    expect(assigned.body.delivery.rider_id).toBe(ids.riderA);

    for (const status of ['verified', 'ready']) {
      const response = await pharmacistA.patch(`/api/orders/${order.id}/status`, { status });
      expect(response.status).toBe(200);
    }
    const dispatched = await pharmacistA.patch(`/api/orders/${order.id}/status`, { status: 'out_for_delivery' });
    expect(dispatched.status).toBe(200);
    expect(dispatched.body.order.status).toBe('out_for_delivery');

    const riderQueue = await riderA.get('/api/rider/deliveries');
    expect(riderQueue.body.items).toHaveLength(1);
    expect(riderQueue.body.items[0].order_id).toBe(order.id);
    expect(riderQueue.body.items[0].digital_address_code).toBe('GD-123-4567');

    expect((await riderB.get('/api/rider/deliveries')).body.items).toHaveLength(0);
    const notMine = await riderB.patch(`/api/rider/deliveries/${order.id}`, { status: 'picked_up' });
    expect(notMine.status).toBe(403);

    const pickedUp = await riderA.patch(`/api/rider/deliveries/${order.id}`, {
      status: 'picked_up',
      notes: 'Collected from counter',
    });
    expect(pickedUp.status).toBe(200);
    expect(pickedUp.body.delivery.status).toBe('picked_up');

    const delivered = await riderA.patch(`/api/rider/deliveries/${order.id}`, { status: 'delivered' });
    expect(delivered.status).toBe(200);
    expect(delivered.body.order.status).toBe('completed');
    expect(delivered.body.delivery.status).toBe('delivered');

    const completed = await customer.get(`/api/orders/${order.id}`);
    expect(completed.body.order.status).toBe('completed');
    expect(completed.body.order.delivery.status).toBe('delivered');

    const queue = await pharmacistA.get('/api/deliveries');
    expect(queue.body.items.some((row) => row.order_id === order.id)).toBe(true);
  });

  it('refuses to assign a rider to a pickup order or dispatch without one', async () => {
    await customer.post('/api/cart/items', {
      medicineId: ids.medicineOtc,
      quantity: 1,
      pharmacyId: ids.pharmacyA,
    });
    const pickup = await customer.post('/api/orders', { fulfilment: 'pickup', paymentMethod: 'cash' });
    const assignment = await pharmacistA.post(`/api/orders/${pickup.body.order.id}/assign-rider`, {
      riderId: ids.riderA,
    });
    expect(assignment.status).toBe(400);
  });

  it('blocks dispatch until a rider is assigned', async () => {
    const order = await placeDeliveryOrder();
    await pharmacistA.patch(`/api/orders/${order.id}/status`, { status: 'verified' });
    await pharmacistA.patch(`/api/orders/${order.id}/status`, { status: 'ready' });
    const dispatch = await pharmacistA.patch(`/api/orders/${order.id}/status`, { status: 'out_for_delivery' });
    expect(dispatch.status).toBe(409);
    expect(dispatch.body.error.message).toMatch(/Assign a rider/i);
  });

  it('scopes rider and delivery queues to the pharmacist pharmacy', async () => {
    const order = await placeDeliveryOrder();
    await pharmacistA.post(`/api/orders/${order.id}/assign-rider`, { riderId: ids.riderA });
    expect((await pharmacistB.get('/api/rider/deliveries')).status).toBe(403);
    expect((await pharmacistB.get('/api/deliveries')).body.items).toHaveLength(0);
    expect((await pharmacistB.get('/api/riders')).body.items).toHaveLength(1);
  });

  it('does not allow a pharmacist to update a delivery assigned to another pharmacy', async () => {
    const order = await placeDeliveryOrder();
    await pharmacistA.post(`/api/orders/${order.id}/assign-rider`, { riderId: ids.riderA });
    const response = await pharmacistB.patch(`/api/orders/${order.id}/status`, { status: 'verified' });
    expect(response.status).toBe(403);
  });
});
