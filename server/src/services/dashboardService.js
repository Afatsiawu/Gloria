import { getDb } from '../db/index.js';
import * as inventoryRepo from '../repositories/inventory.js';
import * as ordersRepo from '../repositories/orders.js';
import { pagination } from '../utils/pagination.js';
import { config } from '../config.js';

function settingNumber(key, fallback) {
  const value = Number(getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key)?.value);
  return Number.isFinite(value) ? value : fallback;
}

export function dashboard(user) {
  const db = getDb();
  const pharmacyId = user.role === 'pharmacist' ? user.pharmacy_id : null;
  const scope = pharmacyId ? 'AND o.pharmacy_id = @pharmacyId' : '';
  const params = pharmacyId ? { pharmacyId } : {};

  const sales = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN date(o.created_at) = date('now') THEN o.total ELSE 0 END), 0) AS today,
         COALESCE(SUM(CASE WHEN strftime('%Y-%m', o.created_at) = strftime('%Y-%m', 'now') THEN o.total ELSE 0 END), 0) AS month,
         COUNT(CASE WHEN date(o.created_at) = date('now') THEN 1 END) AS orders_today
       FROM orders o
       WHERE o.status != 'cancelled' AND o.payment_status IN ('success', 'cash_on_pickup') ${scope}`
    )
    .get(params);

  const orderCounts = db
    .prepare(
      `SELECT
         COUNT(CASE WHEN status IN ('placed','awaiting_prescription','verified','ready','out_for_delivery') THEN 1 END) AS active,
         COUNT(CASE WHEN status = 'awaiting_prescription' THEN 1 END) AS awaiting_prescription,
         COUNT(CASE WHEN status = 'ready' THEN 1 END) AS ready,
         COUNT(CASE WHEN status = 'out_for_delivery' THEN 1 END) AS out_for_delivery
       FROM orders o WHERE 1=1 ${scope}`
    )
    .get(params);

  const prescriptions = db
    .prepare(
      `SELECT COUNT(*) AS c FROM prescriptions p JOIN orders o ON o.id = p.order_id
        WHERE p.status IN ('pending','queried') ${scope}`
    )
    .get(params).c;

  const stock =
    user.role === 'admin'
      ? {
          products: db.prepare("SELECT COUNT(*) AS c FROM medicines WHERE is_active = 1").get().c,
          low_stock: 0,
          expiring_batches: 0,
          expired_batches: 0,
          out_of_stock: 0,
        }
      : inventoryRepo.stockStats(pharmacyId);

  const recent = ordersRepo.list({ pageSize: 8, offset: 0 }, pharmacyId ? { pharmacyId } : {}).items;

  let lowStock = [];
  let expiring = [];
  let expired = [];
  if (pharmacyId) {
    lowStock = inventoryRepo.lowStock(pharmacyId);
    const alerts = inventoryRepo.expiryAlerts(pharmacyId, settingNumber('expiry_alert_days', config.expiryAlertDays));
    expiring = alerts.expiring;
    expired = alerts.expired;
  } else {
    for (const pharmacy of db.prepare('SELECT id, name FROM pharmacies WHERE is_active = 1').all()) {
      lowStock.push(...inventoryRepo.lowStock(pharmacy.id));
      const alerts = inventoryRepo.expiryAlerts(pharmacy.id, settingNumber('expiry_alert_days', config.expiryAlertDays));
      expiring.push(...alerts.expiring.map((row) => ({ ...row, pharmacy_name: pharmacy.name })));
      expired.push(...alerts.expired.map((row) => ({ ...row, pharmacy_name: pharmacy.name })));
    }
  }

  const system =
    user.role === 'admin'
      ? {
          pharmacies: db.prepare('SELECT COUNT(*) AS c FROM pharmacies WHERE is_active = 1').get().c,
          users: db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_active = 1').get().c,
          customers: db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'customer' AND is_active = 1").get().c,
          medicines: db.prepare('SELECT COUNT(*) AS c FROM medicines WHERE is_active = 1').get().c,
        }
      : undefined;

  return {
    role: user.role,
    pharmacy_id: pharmacyId,
    sales: {
      today: Math.round(sales.today * 100) / 100,
      month: Math.round(sales.month * 100) / 100,
      orders_today: sales.orders_today,
    },
    orders: {
      ...orderCounts,
      pending_prescriptions: prescriptions,
    },
    stock: {
      ...stock,
      low_stock: lowStock.length || stock.low_stock,
      expiring_batches: expiring.length || stock.expiring_batches,
      expired_batches: expired.length || stock.expired_batches,
    },
    alerts: {
      low_stock: lowStock.slice(0, 6),
      expiring: expiring.slice(0, 6),
      expired: expired.slice(0, 6),
    },
    recent_orders: recent,
    system,
  };
}
