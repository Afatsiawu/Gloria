import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { resetDb, seedBase } from './fixtures.js';
import { makeClient } from './helpers.js';

const app = createApp();
let ids;
let pharmacist;
let admin;
let customer;
let saleOrder;

beforeEach(async () => {
  resetDb();
  ids = seedBase();
  pharmacist = await makeClient(app);
  await pharmacist.login('+233240000103');
  admin = await makeClient(app);
  await admin.login('+233240000100');
  customer = await makeClient(app);
  await customer.login('+233240000101');

  const sale = await pharmacist.post('/api/orders/walk-in', {
    items: [{ medicineId: ids.medicineOtc, quantity: 2 }],
  });
  saleOrder = sale.body.order;
});

describe('dashboard and analytics', () => {
  it('returns a pharmacist-scoped dashboard', async () => {
    const response = await pharmacist.get('/api/dashboard');
    expect(response.status).toBe(200);
    expect(response.body).toBeTruthy();
  });

  it('summarises paid sales and units for the pharmacy', async () => {
    const response = await pharmacist.get('/api/analytics/summary');
    expect(response.status).toBe(200);
    expect(response.body.totals).toMatchObject({ orders: 1, revenue: 11, units: 2 });
    expect(response.body.top_products[0].brand_name).toBe('Paracetamol');

    const adminView = await admin.get(`/api/analytics/summary?pharmacyId=${ids.pharmacyA}`);
    expect(adminView.body.totals.orders).toBe(1);
    expect(adminView.body.pharmacy_id).toBe(ids.pharmacyA);
  });

  it('rejects a reversed date range', async () => {
    const response = await pharmacist.get('/api/analytics/summary?from=2026-12-01&to=2026-01-01');
    expect(response.status).toBe(400);
  });

  it('forecasts demand and requires an admin to select a pharmacy', async () => {
    const response = await pharmacist.get('/api/analytics/forecast?weeks=4');
    expect(response.status).toBe(200);
    expect(response.body.pharmacy_id).toBe(ids.pharmacyA);
    expect(response.body.items).toHaveLength(3);
    const paracetamol = response.body.items.find((row) => row.medicine_id === ids.medicineOtc);
    expect(paracetamol.units_sold).toBe(2);
    expect(paracetamol.avg_weekly_demand).toBeGreaterThan(0);
    expect(paracetamol.weekly_sales).toHaveLength(4);
    expect(response.body.params).toMatchObject({ window_weeks: 4, lead_time_days: 7, safety_stock_days: 3 });

    expect((await admin.get('/api/analytics/forecast')).status).toBe(400);
    expect((await admin.get(`/api/analytics/forecast?pharmacyId=${ids.pharmacyA}`)).status).toBe(200);
  });

  it('forbids customers from analytics', async () => {
    expect((await customer.get('/api/analytics/summary')).status).toBe(403);
  });
});

describe('exported reports', () => {
  it('streams a sales CSV with a BOM, headers and business data', async () => {
    const response = await pharmacist.get('/api/reports/sales?format=csv');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.text).toContain('Reference');
    expect(response.text).toContain(saleOrder.reference);
    expect(response.text).toContain('Walk-in customer');
  });

  it('streams stock, expiry and orders reports', async () => {
    const stock = await pharmacist.get('/api/reports/stock?format=csv');
    expect(stock.status).toBe(200);
    expect(stock.text).toContain('Paracetamol');
    expect(stock.text).toContain('Stock value');

    const expiry = await pharmacist.get('/api/reports/expiry?format=csv&days=400');
    expect(expiry.status).toBe(200);
    expect(expiry.text).toContain('PAR-EXPIRED');
    expect(expiry.text).toContain('PAR-SOON');

    const orders = await pharmacist.get('/api/reports/orders?format=csv');
    expect(orders.status).toBe(200);
    expect(orders.text).toContain(saleOrder.reference);
  });

  it('streams a PDF report and a PDF receipt', async () => {
    const pdf = await pharmacist.get('/api/reports/sales?format=pdf');
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('.pdf');

    const receipt = await pharmacist.get(`/api/orders/${saleOrder.id}/receipt`);
    expect(receipt.status).toBe(200);
    expect(receipt.headers['content-type']).toContain('application/pdf');
    expect(receipt.headers['content-disposition']).toContain('receipt-');
  });

  it('filters reports by pharmacy for an admin', async () => {
    const response = await admin.get(`/api/reports/sales?format=csv&pharmacyId=${ids.pharmacyB}`);
    expect(response.status).toBe(200);
    expect(response.text).not.toContain(saleOrder.reference);
  });

  it('forbids customers from reports', async () => {
    expect((await customer.get('/api/reports/sales?format=csv')).status).toBe(403);
  });
});
