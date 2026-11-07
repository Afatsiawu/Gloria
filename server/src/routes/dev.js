import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/adminController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { config } from '../config.js';
import { notFound } from '../utils/http.js';

const router = Router();

router.use((req, _res, next) => {
  if (config.isProduction) return next(notFound('Not available in production.'));
  next();
});
router.use(authenticate, requireRole('admin'));

router.get(
  '/outbox',
  validate({ query: z.object({ channel: z.enum(['sms', 'email', 'in_app']).optional() }) }),
  controller.outbox
);
router.post('/jobs/stock-alerts', controller.runAlerts);
router.post('/jobs/refill-reminders', controller.runRefills);

export default router;
