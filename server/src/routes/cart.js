import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/cartController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('customer'));

router.get('/', controller.get);
router.post(
  '/items',
  validate({
    body: z.object({
      medicineId: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().min(1).max(50).default(1),
      pharmacyId: z.coerce.number().int().positive().optional(),
    }),
  }),
  controller.add
);
router.patch(
  '/items/:itemId',
  validate({
    params: z.object({ itemId: z.coerce.number().int().positive() }),
    body: z.object({ quantity: z.coerce.number().int().min(1).max(50) }),
  }),
  controller.update
);
router.delete('/items/:itemId', validate({ params: z.object({ itemId: z.coerce.number().int().positive() }) }), controller.remove);
router.delete('/', controller.clear);

export default router;
