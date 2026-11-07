import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/refillController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { idParam } from './schemas.js';

const router = Router();
router.use(authenticate, requireRole('customer'));
router.get('/', controller.list);
router.post(
  '/',
  validate({
    body: z.object({
      medicineId: z.coerce.number().int().positive(),
      intervalDays: z.coerce.number().int().min(1).max(365).default(30),
      nextDueAt: z.string().datetime().optional(),
    }),
  }),
  controller.upsert
);
router.patch(
  '/:id',
  validate({
    params: idParam,
    body: z.object({
      intervalDays: z.coerce.number().int().min(1).max(365).optional(),
      isActive: z.boolean().optional(),
      nextDueAt: z.string().datetime().optional(),
    }),
  }),
  controller.update
);
router.delete('/:id', validate({ params: idParam }), controller.remove);
export default router;
