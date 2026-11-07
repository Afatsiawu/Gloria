import * as service from '../services/prescriptionService.js';
import { asyncHandler } from '../utils/http.js';

export const upload = asyncHandler(async (req, res) => {
  const prescription = await service.uploadForOrder(req.params.id, req.user, req.file);
  res.status(201).json({ prescription });
});
export const queue = (req, res) => res.json({ items: service.queue(req.user, req.query) });
export const review = (req, res) => res.json({ prescription: service.review(req.params.id, req.user, req.body) });
export const file = (req, res) => {
  const { absolute, mime } = service.fileFor(req.params.id, req.user);
  res.type(mime);
  res.sendFile(absolute);
};
