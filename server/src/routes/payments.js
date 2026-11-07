import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/paymentController.js';
import { validate } from '../utils/validate.js';
import { authenticate } from '../middleware/auth.js';
import { idParam } from './schemas.js';

const router = Router();
// Scope middleware to this router's paths: it is mounted at /api, so a bare
// router.use() would intercept unrelated public routes mounted later.
router.use('/payments', authenticate);
router.get('/payments/order/:orderId', validate({ params: z.object({ orderId: z.coerce.number().int().positive() }) }), controller.forOrder);
router.post('/payments/:id/verify', validate({ params: idParam }), controller.verify);

export default router;
