import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/analyticsController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate, requireRole('pharmacist', 'admin'));

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();
router.get(
  '/summary',
  validate({
    query: z.object({
      from: date,
      to: date,
      pharmacyId: z.coerce.number().int().positive().optional(),
    }),
  }),
  controller.summary
);
router.get(
  '/forecast',
  validate({
    query: z.object({
      pharmacyId: z.coerce.number().int().positive().optional(),
      weeks: z.coerce.number().int().min(1).max(52).optional(),
      leadTimeDays: z.coerce.number().int().min(1).max(180).optional(),
      safetyDays: z.coerce.number().int().min(0).max(90).optional(),
    }),
  }),
  controller.forecast
);

export default router;
