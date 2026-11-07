import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/reportsController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('pharmacist', 'admin'));

const base = z.object({
  format: z.enum(['csv', 'pdf']).default('csv'),
  pharmacyId: z.coerce.number().int().positive().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
  channel: z.enum(['online', 'walk_in']).optional(),
  days: z.coerce.number().int().min(1).max(730).optional(),
});

router.get('/sales', validate({ query: base }), controller.sales);
router.get('/stock', validate({ query: base }), controller.stock);
router.get('/expiry', validate({ query: base }), controller.expiry);
router.get('/orders', validate({ query: base }), controller.orders);

export default router;
