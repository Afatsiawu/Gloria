import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/prescriptionController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { uploadPrescription } from '../middleware/upload.js';
import { idParam } from './schemas.js';

const router = Router();
// This router is mounted at /api; restrict the auth middleware to its paths.
router.use(['/orders', '/prescriptions'], authenticate);

router.post('/orders/:id/prescriptions', requireRole('customer'), uploadPrescription, controller.upload);
router.get(
  '/prescriptions',
  requireRole('pharmacist', 'admin'),
  validate({
    query: z.object({
      status: z.enum(['pending', 'approved', 'rejected', 'queried']).optional(),
      pharmacyId: z.coerce.number().int().positive().optional(),
    }),
  }),
  controller.queue
);
router.patch(
  '/prescriptions/:id/review',
  requireRole('pharmacist', 'admin'),
  validate({
    params: idParam,
    body: z.object({
      status: z.enum(['approved', 'rejected', 'queried']),
      remarks: z.string().trim().max(500).optional(),
    }),
  }),
  controller.review
);
router.get('/prescriptions/:id/file', validate({ params: idParam }), controller.file);

export default router;
