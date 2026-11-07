import * as service from '../services/inventoryService.js';

export const overview = (req, res) => res.json(service.overview(req.user, req.query));
export const batches = (req, res) => res.json(service.batches(req.user, req.query));
export const receive = (req, res) => res.status(201).json({ batch: service.receiveStock(req.user, req.body) });
export const adjust = (req, res) => res.json({ batch: service.adjustStock(req.user, req.params.id, req.body) });
export const alerts = (req, res) => res.json(service.alerts(req.user, req.query));

export const suppliers = (req, res) => res.json({ items: service.listSuppliers(req.user, req.query) });
export const createSupplier = (req, res) => res.status(201).json({ supplier: service.createSupplier(req.user, req.body) });
export const updateSupplier = (req, res) => res.json({ supplier: service.updateSupplier(req.user, req.params.id, req.body) });
export const deleteSupplier = (req, res) => {
  service.deactivateSupplier(req.user, req.params.id);
  res.status(204).end();
};

export const purchaseOrders = (req, res) => res.json({ items: service.purchaseOrders(req.user, req.query) });
export const purchaseOrder = (req, res) => res.json({ purchaseOrder: service.purchaseOrder(req.user, req.params.id) });
export const createPurchaseOrder = (req, res) =>
  res.status(201).json({ purchaseOrder: service.createPurchaseOrder(req.user, req.body) });
export const updatePurchaseOrderStatus = (req, res) =>
  res.json({ purchaseOrder: service.updatePurchaseOrderStatus(req.user, req.params.id, req.body.status) });
export const receivePurchaseOrder = (req, res) =>
  res.json({ purchaseOrder: service.receivePurchaseOrder(req.user, req.params.id, req.body) });
