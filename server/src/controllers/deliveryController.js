import * as service from '../services/deliveryService.js';

export const publicZones = (req, res) => res.json({ items: service.publicZones(req.params.id) });
export const zones = (req, res) => res.json({ items: service.zones(req.user, req.query) });
export const createZone = (req, res) => res.status(201).json({ zone: service.createZone(req.user, req.body) });
export const updateZone = (req, res) => res.json({ zone: service.updateZone(req.user, req.params.id, req.body) });
export const deleteZone = (req, res) => {
  service.deleteZone(req.user, req.params.id);
  res.status(204).end();
};
export const riders = (req, res) => res.json({ items: service.riders(req.user, req.query) });
export const assignRider = (req, res) => res.json({ delivery: service.assignRider(req.user, req.params.id, req.body.riderId) });
export const queue = (req, res) => res.json({ items: service.queue(req.user, req.query) });
export const riderDeliveries = (req, res) => res.json({ items: service.riderDeliveries(req.user, req.query) });
export const riderUpdate = (req, res) => res.json(service.riderUpdate(req.user, req.params.orderId, req.body));
