import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/deliveryController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { idParam } from './schemas.js';

const router = Router();
const pharmacyId = z.coerce.number().int().positive().optional();
const zoneBody = z.object({
  pharmacyId,
  name: z.string().trim().min(2).max(120),
  fee: z.coerce.number().min(0).max(10000),
  rules: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

router.get('/pharmacies/:id/delivery-zones', validate({ params: idParam }), controller.publicZones);

router.get('/delivery-zones', authenticate, requireRole('pharmacist', 'admin'), validate({ query: z.object({ pharmacyId, includeInactive: z.enum(['true', 'false']).optional() }) }), controller.zones);
router.post('/delivery-zones', authenticate, requireRole('pharmacist', 'admin'), validate({ body: zoneBody }), controller.createZone);
router.patch('/delivery-zones/:id', authenticate, requireRole('pharmacist', 'admin'), validate({ params: idParam, body: zoneBody }), controller.updateZone);
router.delete('/delivery-zones/:id', authenticate, requireRole('pharmacist', 'admin'), validate({ params: idParam }), controller.deleteZone);

router.get('/riders', authenticate, requireRole('pharmacist', 'admin'), validate({ query: z.object({ pharmacyId }) }), controller.riders);
router.post(
  '/orders/:id/assign-rider',
  authenticate,
  requireRole('pharmacist', 'admin'),
  validate({ params: idParam, body: z.object({ riderId: z.coerce.number().int().positive() }) }),
  controller.assignRider
);
router.get('/deliveries', authenticate, requireRole('pharmacist', 'admin'), validate({ query: z.object({ pharmacyId }) }), controller.queue);

router.get('/rider/deliveries', authenticate, requireRole('rider'), controller.riderDeliveries);
router.patch(
  '/rider/deliveries/:orderId',
  authenticate,
  requireRole('rider'),
  validate({
    params: z.object({ orderId: z.coerce.number().int().positive() }),
    body: z.object({
      status: z.enum(['picked_up', 'out_for_delivery', 'delivered', 'failed']),
      notes: z.string().trim().max(300).optional(),
    }),
  }),
  controller.riderUpdate
);

export default router;
