import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/orderController.js';
import { receipt } from '../controllers/reportsController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { trackLimiter } from '../middleware/rateLimit.js';
import { paginationSchema, idParam } from './schemas.js';

const router = Router();

const digitalAddress = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}-\d{3}-\d{4}$/, 'Use a Ghana Post GPS code such as GA-123-4567')
  .optional();

// Public: guests prove ownership with reference + phone. Mounted before the
// authenticated routes below. Both values must match (generic 404 otherwise).
router.post(
  '/track',
  trackLimiter,
  validate({
    body: z.object({
      reference: z.string().trim().min(4).max(40),
      phone: z.string().trim().min(7).max(20),
    }),
  }),
  controller.track
);

router.use(authenticate);

const placeSchema = z.object({
  fulfilment: z.enum(['pickup', 'delivery']),
  deliveryZoneId: z.coerce.number().int().positive().optional(),
  deliveryAddress: z.string().trim().max(300).optional(),
  digitalAddressCode: digitalAddress,
  deliveryTime: z.string().trim().max(80).optional(),
  paymentMethod: z.enum(['momo', 'cash']),
  network: z.enum(['MTN', 'Telecel', 'AT']).optional(),
  phone: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
});

router.get(
  '/',
  validate({
    query: paginationSchema.extend({
      status: z.string().optional(),
      channel: z.enum(['online', 'walk_in']).optional(),
      q: z.string().trim().max(120).optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      pharmacyId: z.coerce.number().int().positive().optional(),
    }),
  }),
  controller.list
);
router.post('/', requireRole('customer'), validate({ body: placeSchema }), controller.place);
router.post(
  '/walk-in',
  requireRole('pharmacist', 'admin'),
  validate({
    body: z.object({
      pharmacyId: z.coerce.number().int().positive().optional(),
      items: z
        .array(
          z.object({
            medicineId: z.coerce.number().int().positive(),
            quantity: z.coerce.number().int().min(1).max(500),
          })
        )
        .min(1),
      notes: z.string().trim().max(300).optional(),
    }),
  }),
  controller.walkIn
);
router.get('/:id', validate({ params: idParam }), controller.detail);
router.get('/:id/timeline', validate({ params: idParam }), controller.timeline);
router.get('/:id/receipt', validate({ params: idParam }), receipt);
router.patch(
  '/:id/status',
  requireRole('pharmacist', 'admin'),
  validate({
    params: idParam,
    body: z.object({
      status: z.enum(['placed', 'awaiting_prescription', 'verified', 'ready', 'out_for_delivery', 'completed', 'cancelled']),
      note: z.string().trim().max(500).optional(),
    }),
  }),
  controller.updateStatus
);
router.post(
  '/:id/cancel',
  validate({ params: idParam, body: z.object({ reason: z.string().trim().max(300).optional() }) }),
  controller.cancel
);
router.post('/:id/reorder', validate({ params: idParam }), controller.reorder);

export default router;
