import * as service from '../services/catalogueService.js';

export const pharmacies = (req, res) => {
  res.json({ items: service.pharmacies(req.query.includeInactive === 'true', req.user) });
};
export const categories = (_req, res) => res.json({ items: service.categories() });
export const search = (req, res) => res.json(service.search(req.query, req.user));
export const detail = (req, res) => res.json(service.detail(req.params.id));
export const createCategory = (req, res) => res.status(201).json({ category: service.createCategory(req.body, req.user, req.ip) });
export const updateCategory = (req, res) => res.json({ category: service.updateCategory(req.params.id, req.body, req.user, req.ip) });
export const deleteCategory = (req, res) => {
  service.deleteCategory(req.params.id, req.user, req.ip);
  res.status(204).end();
};
export const createMedicine = (req, res) => res.status(201).json({ medicine: service.createMedicine(req.body, req.user, req.ip) });
export const updateMedicine = (req, res) => res.json({ medicine: service.updateMedicine(req.params.id, req.body, req.user, req.ip) });
export const setPharmacyPrice = (req, res) =>
  res.json({ pharmacyMedicine: service.setPharmacyPrice(req.params.pharmacyId, req.params.medicineId, req.body, req.user, req.ip) });
export const logUnmet = (req, res) => res.status(201).json(service.logUnmetPublic(req.body));
