import { getDb } from '../db/index.js';
import * as analyticsRepo from '../repositories/analytics.js';
import { resolvePharmacy } from '../utils/access.js';
import { config } from '../config.js';
import { badRequest } from '../utils/http.js';

const DAY = 24 * 60 * 60 * 1000;

function defaultRange(from, to) {
  const end = to || new Date().toISOString().slice(0, 10);
  const start = from || new Date(Date.now() - 29 * DAY).toISOString().slice(0, 10);
  if (start > end) throw badRequest('The start date must be before the end date.');
  return { from: start, to: end };
}

function scopedPharmacy(user, requested) {
  if (user.role === 'pharmacist') return user.pharmacy_id;
  return requested ? Number(requested) : null;
}

function fillTrend(trend, from, to) {
  const map = new Map(trend.map((row) => [row.date, row]));
  const out = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  for (let d = start; d <= end; d = new Date(d.getTime() + DAY)) {
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, revenue: map.get(key)?.revenue || 0, orders: map.get(key)?.orders || 0 });
  }
  return out;
}

export function summary(user, query) {
  const { from, to } = defaultRange(query.from, query.to);
  const pharmacyId = scopedPharmacy(user, query.pharmacyId);
  const data = analyticsRepo.summary({ from, to, pharmacyId });
  if (data.trend.length <= 400) data.trend = fillTrend(data.trend, from, to);
  data.pharmacy_id = pharmacyId;
  return data;
}

function settingNumber(key, fallback) {
  const value = Number(getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value);
  return Number.isFinite(value) ? value : fallback;
}

export function forecast(user, query) {
  if (user.role === 'admin' && !query.pharmacyId) {
    throw badRequest('Select a pharmacy to forecast its demand.');
  }
  const pharmacyId = resolvePharmacy(user, query.pharmacyId);
  const weeks = Math.min(52, Math.max(1, Number(query.weeks) || settingNumber('forecast_window_weeks', config.forecastWindowWeeks)));
  const leadTimeDays = Math.min(180, Math.max(1, Number(query.leadTimeDays) || settingNumber('forecast_lead_time_days', config.forecastLeadTimeDays)));
  const safetyDays = Math.min(90, Math.max(0, Number(query.safetyDays ?? settingNumber('safety_stock_days', config.safetyStockDays))));
  const { medicines, sales, labels } = analyticsRepo.forecastData(pharmacyId, weeks);

  const salesMap = new Map();
  for (const row of sales) {
    if (!salesMap.has(row.medicine_id)) salesMap.set(row.medicine_id, new Map());
    const bucket = salesMap.get(row.medicine_id);
    bucket.set(row.week, (bucket.get(row.week) || 0) + row.quantity);
  }

  const items = medicines.map((medicine) => {
    const bucket = salesMap.get(medicine.medicine_id) || new Map();
    const weekly = labels.map((week) => bucket.get(week) || 0);
    const total = weekly.reduce((sum, qty) => sum + qty, 0);
    const avgWeekly = total / weeks;
    const daily = avgWeekly / 7;
    const forecastLead = daily * leadTimeDays;
    const safetyStock = daily * safetyDays;
    const suggested = Math.max(0, Math.ceil(forecastLead + safetyStock - medicine.on_hand));
    return {
      ...medicine,
      weekly_sales: labels.map((week, i) => ({ week, quantity: weekly[i] })),
      units_sold: total,
      avg_weekly_demand: Math.round(avgWeekly * 100) / 100,
      forecast_lead_time_demand: Math.round(forecastLead * 100) / 100,
      safety_stock: Math.round(safetyStock * 100) / 100,
      suggested_reorder: suggested,
      below_reorder_level: medicine.on_hand <= medicine.reorder_level,
    };
  });
  items.sort((a, b) => b.suggested_reorder - a.suggested_reorder || b.avg_weekly_demand - a.avg_weekly_demand);

  return {
    pharmacy_id: pharmacyId,
    params: { window_weeks: weeks, lead_time_days: leadTimeDays, safety_stock_days: safetyDays },
    formula:
      'suggested reorder = ceil( (average weekly demand ÷ 7) × lead time days + (average weekly demand ÷ 7) × safety stock days − on-hand stock )',
    labels,
    items,
    generated_at: new Date().toISOString(),
  };
}
