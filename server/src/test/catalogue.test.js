import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { getDb } from '../db/index.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient } from './helpers.js';

const app = createApp();
let ids;

beforeEach(() => {
  resetDb();
  ids = seedBase();
});

describe('public catalogue', () => {
  it('lists active pharmacies with staff counts', async () => {
    const client = await makeClient(app);
    const response = await client.get('/api/pharmacies');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items.map((p) => p.community).sort()).toEqual(['Doryumu', 'Kordibe']);
  });

  it('searches by brand or generic name and aggregates availability', async () => {
    const client = await makeClient(app);
    const response = await client.get('/api/medicines?q=para');
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    const medicine = response.body.items[0];
    expect(medicine.brand_name).toBe('Paracetamol');
    expect(medicine.stock).toBe(37);
    expect(medicine.pharmacy_count).toBe(2);
    expect(medicine.min_price).toBe(5.5);
    expect(medicine.max_price).toBe(6);
  });

  it('filters prescription-only medicines', async () => {
    const client = await makeClient(app);
    const rx = await client.get('/api/medicines?rx=true');
    expect(rx.body.items.map((m) => m.brand_name)).toEqual(['Amoxil']);
    const otc = await client.get('/api/medicines?rx=false');
    expect(otc.body.items.map((m) => m.brand_name).sort()).toEqual(['ORS Plus', 'Paracetamol']);
  });

  it('filters to medicines that are actually in stock', async () => {
    const client = await makeClient(app);
    const response = await client.get('/api/medicines?available=true');
    const names = response.body.items.map((m) => m.brand_name).sort();
    expect(names).toEqual(['Amoxil', 'Paracetamol']);
  });

  it('filters by community stock', async () => {
    const client = await makeClient(app);
    const response = await client.get('/api/medicines?community=Kordibe');
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].brand_name).toBe('Paracetamol');
  });

  it('returns a medicine with per-pharmacy availability, soonest expiry first', async () => {
    const client = await makeClient(app);
    const response = await client.get(`/api/medicines/${ids.medicineOtc}`);
    expect(response.status).toBe(200);
    expect(response.body.medicine.brand_name).toBe('Paracetamol');
    expect(response.body.availability).toHaveLength(2);
    const doryumu = response.body.availability.find((row) => row.pharmacy_id === ids.pharmacyA);
    expect(doryumu.stock).toBe(30);
    expect(response.body.availability[0].pharmacy_id).toBe(ids.pharmacyA);
  });

  it('returns 404 for an unknown medicine', async () => {
    const client = await makeClient(app);
    expect((await client.get('/api/medicines/99999')).status).toBe(404);
  });

  it('records a search with no results as unmet demand', async () => {
    const client = await makeClient(app);
    const search = await client.get('/api/medicines?q=Unobtainium');
    expect(search.body.items).toHaveLength(0);
    const rows = getDb().prepare('SELECT * FROM unmet_requests').all();
    expect(rows).toHaveLength(1);
    expect(rows[0].searched_term).toBe('Unobtainium');

    const explicit = await client.post('/api/unmet-requests', {
      searchedTerm: 'Vitamin C',
      pharmacyId: ids.pharmacyA,
      community: 'Doryumu',
    });
    expect(explicit.status).toBe(201);
    expect(getDb().prepare('SELECT COUNT(*) AS c FROM unmet_requests').get().c).toBe(2);
  });
});

describe('catalogue administration', () => {
  it('lets an admin create a category and a medicine priced at every pharmacy', async () => {
    const admin = await makeClient(app);
    await admin.login('+233240000100');

    const category = await admin.post('/api/categories', { name: 'Vitamins', description: 'Supplements' });
    expect(category.status).toBe(201);

    const medicine = await admin.post('/api/medicines', {
      brandName: 'Vitamin C',
      genericName: 'Ascorbic acid',
      strength: '100 mg',
      dosageForm: 'Tablet',
      categoryId: category.body.category.id,
      requiresPrescription: false,
      price: 4.25,
      reorderLevel: 15,
    });
    expect(medicine.status).toBe(201);

    const prices = getDb()
      .prepare('SELECT * FROM pharmacy_medicines WHERE medicine_id = ? ORDER BY pharmacy_id')
      .all(medicine.body.medicine.id);
    expect(prices).toHaveLength(2);
    expect(prices.every((row) => row.price === 4.25 && row.reorder_level === 15)).toBe(true);
  });

  it('lets a pharmacist adjust only their own pharmacy price', async () => {
    const pharmacist = await makeClient(app);
    await pharmacist.login('+233240000103');

    const own = await pharmacist.patch(`/api/pharmacies/${ids.pharmacyA}/medicines/${ids.medicineOtc}`, {
      price: 6.25,
      reorderLevel: 12,
    });
    expect(own.status).toBe(200);
    expect(own.body.pharmacyMedicine.price).toBe(6.25);

    const other = await pharmacist.patch(`/api/pharmacies/${ids.pharmacyB}/medicines/${ids.medicineOtc}`, {
      price: 9,
    });
    expect(other.status).toBe(403);
  });

  it('forbids non-admins from creating medicines or listing inactive records', async () => {
    const pharmacist = await makeClient(app);
    await pharmacist.login('+233240000103');
    const created = await pharmacist.post('/api/medicines', {
      brandName: 'Test',
      genericName: 'Test',
    });
    expect(created.status).toBe(403);
    expect((await pharmacist.get('/api/medicines?includeInactive=true')).status).toBe(403);

    const anonymous = await makeClient(app);
    expect((await anonymous.get('/api/medicines?includeInactive=true')).status).toBe(403);
  });

  it('lets an admin deactivate a medicine so it disappears from the shop', async () => {
    const admin = await makeClient(app);
    await admin.login('+233240000100');
    const before = await admin.get(`/api/medicines/${ids.medicineNoStock}`);
    const updated = await admin.patch(`/api/medicines/${ids.medicineNoStock}`, {
      brandName: before.body.medicine.brand_name,
      genericName: before.body.medicine.generic_name,
      isActive: false,
    });
    expect(updated.status).toBe(200);

    const shop = await makeClient(app);
    const results = await shop.get('/api/medicines?q=ORS');
    expect(results.body.items).toHaveLength(0);
  });
});
