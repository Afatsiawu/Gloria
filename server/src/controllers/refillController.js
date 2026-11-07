import * as service from '../services/refillService.js';

export const list = (req, res) => res.json({ items: service.list(req.user.id) });
export const upsert = (req, res) => res.status(201).json({ reminder: service.upsert(req.user.id, req.body) });
export const update = (req, res) => res.json({ reminder: service.update(req.user.id, req.params.id, req.body) });
export const remove = (req, res) => {
  service.remove(req.user.id, req.params.id);
  res.status(204).end();
};
