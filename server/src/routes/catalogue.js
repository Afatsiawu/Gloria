import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/catalogueController.js';
import { validate } from '../utils/validate.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { paginationSchema, idParam } from './schemas.js';

const router = Router();

const categoryBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
});

const medicineBody = z.object({
  brandName: z.string().trim().min(2).max(120),
  genericName: z.string().trim().min(2).max(120),
  strength: z.string().trim().max(60).optional(),
  dosageForm: z.string().trim().max(60).optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  requiresPrescription: z.boolean().default(false),
  description: z.string().trim().max(1000).optional(),
  price: z.coerce.number().min(0).max(100000).optional(),
  reorderLevel: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional(),
});

router.get('/pharmacies', optionalAuth, controller.pharmacies);
router.get('/categories', controller.categories);
router.post('/categories', authenticate, requireRole('admin'), validate({ body: categoryBody }), controller.createCategory);
router.patch(
  '/categories/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idParam, body: categoryBody }),
  controller.updateCategory
);
router.delete('/categories/:id', authenticate, requireRole('admin'), validate({ params: idParam }), controller.deleteCategory);

router.get(
  '/medicines',
  optionalAuth,
  validate({
    query: paginationSchema.extend({
      q: z.string().trim().max(120).optional(),
      categoryId: z.coerce.number().int().positive().optional(),
      available: z.enum(['true', 'false']).optional(),
      rx: z.enum(['true', 'false']).optional(),
      community: z.enum(['Doryumu', 'Kordibe']).optional(),
      includeInactive: z.enum(['true', 'false']).optional(),
    }),
  }),
  controller.search
);
router.get('/medicines/:id', validate({ params: idParam }), controller.detail);
router.post('/medicines', authenticate, requireRole('admin'), validate({ body: medicineBody }), controller.createMedicine);
router.patch(
  '/medicines/:id',
  authenticate,
  requireRole('admin'),
  validate({ params: idParam, body: medicineBody }),
  controller.updateMedicine
);
router.patch(
  '/pharmacies/:pharmacyId/medicines/:medicineId',
  authenticate,
  requireRole('pharmacist', 'admin'),
  validate({
    params: z.object({
      pharmacyId: z.coerce.number().int().positive(),
      medicineId: z.coerce.number().int().positive(),
    }),
    body: z.object({
      price: z.coerce.number().min(0).max(100000),
      reorderLevel: z.coerce.number().int().min(0).max(100000).optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  controller.setPharmacyPrice
);
router.post(
  '/unmet-requests',
  validate({
    body: z.object({
      searchedTerm: z.string().trim().min(1).max(200),
      pharmacyId: z.coerce.number().int().positive().optional(),
      medicineId: z.coerce.number().int().positive().optional(),
      community: z.enum(['Doryumu', 'Kordibe']).optional(),
    }),
  }),
  controller.logUnmet
);

export default router;
