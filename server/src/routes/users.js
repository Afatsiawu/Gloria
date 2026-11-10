import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/userController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { paginationSchema } from './schemas.js';
import { isValidGhanaPhone } from '../utils/phone.js';

const router = Router();
router.use(authenticate, requireRole('admin'));

const userBody = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().refine(isValidGhanaPhone, 'Enter a valid Ghana mobile number'),
  email: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  role: z.enum(['customer', 'pharmacist', 'admin', 'rider']),
  pharmacyId: z.coerce.number().int().positive().nullable().optional(),
  community: z.enum(['Doryumu', 'Kordibe']).nullable().optional(),
  deliveryAddress: z.string().trim().max(300).nullable().optional(),
  digitalAddressCode: z.string().trim().max(20).nullable().optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

const createBody = userBody.extend({ password: z.string().min(8, 'Password must be at least 8 characters') });

router.get('/', validate({ query: paginationSchema.extend({ role: z.string().optional(), pharmacyId: z.coerce.number().optional(), q: z.string().optional(), active: z.coerce.boolean().optional() }) }), controller.list);
router.post('/', validate({ body: createBody }), controller.create);
router.patch('/:id', validate({ body: userBody, params: z.object({ id: z.coerce.number().int() }) }), controller.update);
router.post('/:id/suspend', controller.suspend);
router.post('/:id/activate', controller.activate);

export default router;
