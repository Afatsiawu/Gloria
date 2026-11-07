import * as orderService from '../services/orderService.js';
import { asyncHandler } from '../utils/http.js';

export const list = (req, res) => res.json(orderService.listOrders(req.user, req.query));
export const detail = (req, res) => res.json({ order: orderService.getOrder(req.params.id, req.user) });
export const timeline = (req, res) => res.json(orderService.timeline(req.params.id, req.user));
export const place = asyncHandler(async (req, res) => {
  const order = await orderService.placeOrder(req.user, req.body);
  res.status(201).json({ order });
});
export const updateStatus = (req, res) => {
  res.json({ order: orderService.updateOrderStatus(req.params.id, req.body.status, req.user, req.body.note) });
};
export const cancel = (req, res) => {
  res.json({ order: orderService.cancelOrder(req.params.id, req.user, req.body.reason) });
};
export const reorder = (req, res) => res.json(orderService.reorder(req.params.id, req.user));
export const walkIn = (req, res) => {
  res.status(201).json({ order: orderService.createWalkInSale(req.user, req.body) });
};
