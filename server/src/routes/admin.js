import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/adminController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { paginationSchema, idParam } from './schemas.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get('/settings', controller.settings);
router.patch(
  '/settings',
  validate({
    body: z.object({
      expiry_alert_days: z.coerce.number().int().min(1).max(730).optional(),
      forecast_window_weeks: z.coerce.number().int().min(1).max(52).optional(),
      forecast_lead_time_days: z.coerce.number().int().min(1).max(180).optional(),
      safety_stock_days: z.coerce.number().int().min(0).max(90).optional(),
      backup_retention_days: z.coerce.number().int().min(1).max(365).optional(),
    }),
  }),
  controller.updateSettings
);
router.get(
  '/audit',
  validate({
    query: paginationSchema.extend({
      entity: z.string().optional(),
      action: z.string().optional(),
      userId: z.coerce.number().int().positive().optional(),
    }),
  }),
  controller.audit
);
router.get('/backups', controller.backups);
router.post('/backups', controller.backupNow);
router.get('/data-requests', controller.dataRequests);
router.post('/data-requests/:id/process', validate({ params: idParam }), controller.processDataRequest);

export default router;
