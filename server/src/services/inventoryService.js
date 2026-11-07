import { getDb } from '../db/index.js';
import * as inventoryRepo from '../repositories/inventory.js';
import * as catalogueRepo from '../repositories/catalogue.js';
import * as supplierRepo from '../repositories/suppliers.js';
import * as purchaseRepo from '../repositories/purchase.js';
import { recordAudit } from '../repositories/audit.js';
import { resolvePharmacy } from '../utils/access.js';
import { badRequest, conflict, notFound } from '../utils/http.js';
import { pagination, paged } from '../utils/pagination.js';
import { config } from '../config.js';

const today = () => new Date().toISOString().slice(0, 10);

function settingNumber(key, fallback) {
  const row = getDb().prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  const value = Number(row?.value);
  return Number.isFinite(value) ? value : fallback;
}

export function overview(user, query) {
  const pharmacyId = resolvePharmacy(user, query.pharmacyId);
  const { page, pageSize, offset } = pagination(query);
  const { items, total } = inventoryRepo.stockOverview(pharmacyId, {
    q: query.q,
    lowOnly: query.lowOnly === 'true',
    pageSize,
    offset,
  });
  return paged(items, total, page, pageSize);
}

export function batches(user, query) {
  const pharmacyId = resolvePharmacy(user, query.pharmacyId);
  const { page, pageSize, offset } = pagination(query);
  const { items, total } = inventoryRepo.batchList(pharmacyId, {
    medicineId: query.medicineId,
    q: query.q,
    includeEmpty: query.includeEmpty === 'true',
    pageSize,
    offset,
  });
  return paged(items, total, page, pageSize);
}

export function receiveStock(user, input) {
  const pharmacyId = resolvePharmacy(user, input.pharmacyId);
  const medicine = catalogueRepo.getMedicine(input.medicineId);
  if (!medicine) throw notFound('Medicine not found.');
  if (input.expiryDate < today()) throw badRequest('You cannot receive stock that has already expired.');
  if (input.supplierId) {
    const supplier = supplierRepo.get(input.supplierId);
    if (!supplier || supplier.pharmacy_id !== pharmacyId) throw badRequest('Choose a supplier for this pharmacy.');
  }
  const exists = getDb()
    .prepare('SELECT id FROM batches WHERE pharmacy_id = ? AND medicine_id = ? AND batch_no = ?')
    .get(pharmacyId, input.medicineId, input.batchNo);
  if (exists) throw conflict('That batch number already exists for this medicine.');
  const batch = inventoryRepo.receiveBatch({
    pharmacyId,
    medicineId: input.medicineId,
    batchNo: input.batchNo,
    supplierId: input.supplierId || null,
    expiryDate: input.expiryDate,
    quantity: input.quantity,
    purchaseOrderId: null,
  });
  recordAudit({
    userId: user.id,
    action: 'stock_received',
    entity: 'batch',
    entityId: batch.id,
    after: { medicine_id: input.medicineId, quantity: input.quantity, expiry_date: input.expiryDate },
  });
  return batch;
}

export function adjustStock(user, batchId, input) {
  const batch = getDb().prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  if (!batch) throw notFound('Batch not found.');
  resolvePharmacy(user, batch.pharmacy_id);
  if (!input.delta) throw badRequest('Enter a non-zero adjustment.');
  const result = inventoryRepo.adjustBatch(batchId, input.delta, input.reason, user.id);
  recordAudit({
    userId: user.id,
    action: 'stock_adjusted',
    entity: 'batch',
    entityId: batchId,
    before: { quantity_on_hand: result.before.quantity_on_hand },
    after: { quantity_on_hand: result.after.quantity_on_hand, reason: input.reason },
  });
  return result.after;
}

export function alerts(user, query) {
  const pharmacyId = user.role === 'admin' ? query.pharmacyId ? Number(query.pharmacyId) : null : user.pharmacy_id;
  const days = Number(query.days) || settingNumber('expiry_alert_days', config.expiryAlertDays);
  if (pharmacyId) {
    return {
      days,
      low_stock: inventoryRepo.lowStock(pharmacyId),
      ...inventoryRepo.expiryAlerts(pharmacyId, days),
    };
  }
  const pharmacies = catalogueRepo.listPharmacies();
  const low = [];
  const expiring = [];
  const expired = [];
  for (const pharmacy of pharmacies) {
    low.push(...inventoryRepo.lowStock(pharmacy.id).map((row) => ({ ...row, pharmacy_name: pharmacy.name, community: pharmacy.community })));
    const result = inventoryRepo.expiryAlerts(pharmacy.id, days);
    expiring.push(...result.expiring.map((row) => ({ ...row, pharmacy_name: pharmacy.name, community: pharmacy.community })));
    expired.push(...result.expired.map((row) => ({ ...row, pharmacy_name: pharmacy.name, community: pharmacy.community })));
  }
  return { days, low_stock: low, expiring, expired };
}

// ---- suppliers ----
export function listSuppliers(user, query) {
  const pharmacyId = resolvePharmacy(user, query.pharmacyId);
  return supplierRepo.list(pharmacyId, query.includeInactive === 'true');
}

export function createSupplier(user, input) {
  const pharmacyId = resolvePharmacy(user, input.pharmacyId);
  const supplier = supplierRepo.create({
    pharmacyId,
    name: input.name,
    contactPerson: input.contactPerson || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
  });
  recordAudit({ userId: user.id, action: 'supplier_created', entity: 'supplier', entityId: supplier.id, after: supplier });
  return supplier;
}

export function updateSupplier(user, id, input) {
  const supplier = supplierRepo.get(id);
  if (!supplier) throw notFound('Supplier not found.');
  resolvePharmacy(user, supplier.pharmacy_id);
  const updated = supplierRepo.update(id, {
    name: input.name,
    contactPerson: input.contactPerson || null,
    phone: input.phone || null,
    email: input.email || null,
    address: input.address || null,
    isActive: input.isActive === false ? 0 : 1,
  });
  recordAudit({
    userId: user.id,
    action: 'supplier_updated',
    entity: 'supplier',
    entityId: id,
    before: supplier,
    after: updated,
  });
  return updated;
}

export function deactivateSupplier(user, id) {
  const supplier = supplierRepo.get(id);
  if (!supplier) throw notFound('Supplier not found.');
  resolvePharmacy(user, supplier.pharmacy_id);
  supplierRepo.deactivate(id);
  recordAudit({ userId: user.id, action: 'supplier_deactivated', entity: 'supplier', entityId: id });
}

// ---- purchase orders ----
export function purchaseOrders(user, query) {
  const pharmacyId = resolvePharmacy(user, query.pharmacyId);
  return purchaseRepo.list(pharmacyId, query.status);
}

export function purchaseOrder(user, id) {
  const po = purchaseRepo.detail(id);
  if (!po) throw notFound('Purchase order not found.');
  resolvePharmacy(user, po.pharmacy_id);
  return po;
}

export function createPurchaseOrder(user, input) {
  const pharmacyId = resolvePharmacy(user, input.pharmacyId);
  const supplier = supplierRepo.get(input.supplierId);
  if (!supplier || supplier.pharmacy_id !== pharmacyId) throw badRequest('Choose a supplier for this pharmacy.');
  for (const item of input.items) {
    if (!catalogueRepo.getMedicine(item.medicineId)) throw badRequest('One of the medicines does not exist.');
  }
  const po = purchaseRepo.create({ pharmacyId, supplierId: input.supplierId, createdBy: user.id }, input.items);
  recordAudit({ userId: user.id, action: 'purchase_order_created', entity: 'purchase_order', entityId: po.id, after: po });
  return po;
}

export function updatePurchaseOrderStatus(user, id, status) {
  const po = purchaseRepo.detail(id);
  if (!po) throw notFound('Purchase order not found.');
  resolvePharmacy(user, po.pharmacy_id);
  if (po.status === 'received') throw conflict('A received purchase order cannot be changed.');
  if (!['ordered', 'cancelled'].includes(status) || po.status !== 'draft') {
    throw conflict('Only a draft purchase order can be marked as ordered or cancelled.');
  }
  const updated = purchaseRepo.updateStatus(id, status);
  recordAudit({
    userId: user.id,
    action: `purchase_order_${status}`,
    entity: 'purchase_order',
    entityId: id,
    before: { status: po.status },
    after: { status },
  });
  return updated;
}

export function receivePurchaseOrder(user, id, input) {
  const po = purchaseRepo.detail(id);
  if (!po) throw notFound('Purchase order not found.');
  resolvePharmacy(user, po.pharmacy_id);
  if (po.status === 'cancelled') throw conflict('This purchase order was cancelled.');
  if (po.status === 'draft') throw conflict('Mark the purchase order as ordered before receiving goods.');
  for (const receipt of input.items) {
    if (receipt.expiryDate < today()) throw badRequest('Received stock cannot already be expired.');
    const item = po.items.find((i) => i.id === receipt.purchaseOrderItemId);
    if (!item) throw badRequest('One of the receipt lines does not belong to this purchase order.');
    if (receipt.quantityReceived > item.outstanding) {
      throw badRequest(`Received quantity for ${item.brand_name} exceeds the outstanding quantity.`);
    }
    if (!receipt.batchNo?.trim()) throw badRequest('A batch number is required for every received line.');
  }
  try {
    return purchaseRepo.receive(id, input.items, user);
  } catch (err) {
    throw conflict(err.message);
  }
}
