import * as paymentService from '../services/paymentService.js';
import { asyncHandler } from '../utils/http.js';

export const verify = asyncHandler(async (req, res) => {
  const result = await paymentService.verifyPayment(req.params.id, req.user);
  res.json({ payment: result.payment, order_status: result.order.status, payment_status: result.order.payment_status });
});

export const forOrder = (req, res) => {
  res.json({ items: paymentService.listPaymentsForOrder(req.params.orderId, req.user) });
};
