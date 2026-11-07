import * as repo from '../repositories/catalogue.js';
import { recordAudit } from '../repositories/audit.js';
import { badRequest, notFound, forbidden } from '../utils/http.js';
import { pagination, paged } from '../utils/pagination.js';

export function search(query, user) {
  const { page, pageSize, offset } = pagination(query);
  const includeInactive = query.includeInactive === 'true' || query.includeInactive === true;
  if (includeInactive && user?.role !== 'admin') {
    throw forbidden('Only an administrator can list inactive medicines.');
  }
  const result = repo.searchMedicines({
    q: query.q,
    categoryId: query.categoryId,
    available: query.available === 'true' || query.available === true,
    rx: query.rx === undefined || query.rx === '' ? undefined : query.rx === 'true' || query.rx === true,
    community: query.community,
    pageSize,
    offset,
    includeInactive,
  });
  if (result.items.length === 0 && query.q) {
    repo.logUnmet({ term: query.q, community: query.community || null });
  }
  return paged(result.items, result.total, page, pageSize);
}

export function detail(id) {
  const medicine = repo.getMedicine(id);
  if (!medicine) throw notFound('Medicine not found.');
  return { medicine, availability: repo.availability(id) };
}

export function pharmacies(includeInactive, user) {
  if (includeInactive && user?.role !== 'admin') {
    throw forbidden('Only an administrator can list inactive pharmacies.');
  }
  return repo.listPharmacies(includeInactive);
}

export function categories() {
  return repo.listCategories();
}

export function createCategory(body, actor, ip) {
  const category = repo.createCategory(body.name.trim(), body.description);
  recordAudit({ userId: actor.id, action: 'category_created', entity: 'category', entityId: category.id, after: category, ip });
  return category;
}

export function updateCategory(id, body, actor, ip) {
  const before = repo.listCategories().find((c) => c.id === Number(id));
  if (!before) throw notFound('Category not found.');
  const category = repo.updateCategory(id, body.name.trim(), body.description);
  recordAudit({ userId: actor.id, action: 'category_updated', entity: 'category', entityId: Number(id), before, after: category, ip });
  return category;
}

export function deleteCategory(id, actor, ip) {
  const before = repo.listCategories().find((c) => c.id === Number(id));
  if (!before) throw notFound('Category not found.');
  repo.deleteCategory(id);
  recordAudit({ userId: actor.id, action: 'category_deleted', entity: 'category', entityId: Number(id), before, ip });
}

function medicinePayload(body, existing = {}) {
  return {
    brandName: body.brandName.trim(),
    genericName: body.genericName.trim(),
    strength: body.strength || null,
    dosageForm: body.dosageForm || null,
    categoryId: body.categoryId || null,
    requiresPrescription: body.requiresPrescription ? 1 : 0,
    description: body.description || null,
    imagePath: existing.image_path || null,
    isActive: body.isActive === false ? 0 : 1,
  };
}

export function createMedicine(body, actor, ip) {
  const medicine = repo.createMedicine(medicinePayload(body));
  repo.setBasePrice(medicine.id, body.price ?? 0, body.reorderLevel ?? 10);
  recordAudit({
    userId: actor.id,
    action: 'medicine_created',
    entity: 'medicine',
    entityId: medicine.id,
    after: { ...medicine, base_price: body.price ?? 0 },
    ip,
  });
  return medicine;
}

export function updateMedicine(id, body, actor, ip) {
  const before = repo.getMedicine(id);
  if (!before) throw notFound('Medicine not found.');
  const medicine = repo.updateMedicine(id, medicinePayload(body, before));
  if (body.price !== undefined) {
    repo.setBasePrice(id, body.price, body.reorderLevel ?? 10);
    recordAudit({
      userId: actor.id,
      action: 'price_changed',
      entity: 'medicine',
      entityId: medicine.id,
      before: { base_price: before.min_price },
      after: { base_price: body.price },
      ip,
    });
  }
  recordAudit({ userId: actor.id, action: 'medicine_updated', entity: 'medicine', entityId: medicine.id, before, after: medicine, ip });
  return medicine;
}

export function setPharmacyPrice(pharmacyId, medicineId, body, actor, ip) {
  if (actor.role !== 'admin' && actor.pharmacy_id !== Number(pharmacyId)) {
    throw forbidden('You can only change prices at your own pharmacy.');
  }
  if (!repo.getPharmacy(pharmacyId)) throw notFound('Pharmacy not found.');
  if (!repo.getMedicine(medicineId)) throw notFound('Medicine not found.');
  const before = repo.getPharmacyMedicine(pharmacyId, medicineId);
  if (!(body.price >= 0)) throw badRequest('Price must be zero or more.');
  const after = repo.upsertPharmacyMedicine({
    pharmacyId: Number(pharmacyId),
    medicineId: Number(medicineId),
    price: body.price,
    reorderLevel: body.reorderLevel ?? before?.reorder_level ?? 10,
    isActive: body.isActive ?? before?.is_active ?? 1,
  });
  recordAudit({
    userId: actor.id,
    action: 'price_changed',
    entity: 'pharmacy_medicine',
    entityId: medicineId,
    before,
    after,
    ip,
  });
  return after;
}

export function logUnmetPublic(body) {
  repo.logUnmet({
    pharmacyId: body.pharmacyId || null,
    medicineId: body.medicineId || null,
    term: body.searchedTerm,
    community: body.community || null,
  });
  return { message: 'Thanks. Pharmacies can now see this demand in their reports.' };
}
