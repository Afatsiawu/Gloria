import { Router } from 'express';
import { z } from 'zod';
import * as guestController from '../controllers/guestController.js';
import { validate } from '../utils/validate.js';
import { uploadPrescription } from '../middleware/upload.js';
import { guestOrderLimiter, trackLimiter } from '../middleware/rateLimit.js';
import { idParam } from './schemas.js';

const router = Router();

const guestOrderSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(20),
  email: z.union([z.string().trim().email().max(160), z.literal('')]).optional(),
  pharmacyId: z.coerce.number().int().positive(),
  items: z
    .array(
      z.object({
        medicineId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(50),
      })
    )
    .min(1)
    .max(50),
  fulfilment: z.enum(['pickup', 'delivery']),
  deliveryZoneId: z.coerce.number().int().positive().optional(),
  deliveryAddress: z.string().trim().max(300).optional(),
  digitalAddressCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}-\d{3}-\d{4}$/, 'Use a Ghana Post GPS code such as GA-123-4567')
    .optional(),
  paymentMethod: z.enum(['momo', 'cash']),
  network: z.enum(['MTN', 'Telecel', 'AT']).optional(),
  momoPhone: z.string().trim().min(7).max(20).optional(),
  notes: z.string().trim().max(500).optional(),
  consent: z.boolean().refine((value) => value === true, {
    message: 'You must agree to the privacy notice before placing an order.',
  }),
});

router.post('/orders', guestOrderLimiter, validate({ body: guestOrderSchema }), guestController.place);
router.post(
  '/orders/:id/prescription',
  trackLimiter,
  validate({ params: idParam }),
  uploadPrescription,
  guestController.uploadPrescription
);

export default router;
