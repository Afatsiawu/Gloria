import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/inventoryController.js';
import { validate } from '../utils/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { paginationSchema, idParam } from './schemas.js';

const router = Router();
// Mounted at /api, so scope staff auth to these prefixes only.
router.use(['/inventory', '/suppliers', '/purchase-orders'], authenticate, requireRole('pharmacist', 'admin'));

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format');
const pharmacyId = z.coerce.number().int().positive().optional();

router.get(
  '/inventory',
  validate({
    query: paginationSchema.extend({
      pharmacyId,
      q: z.string().trim().max(120).optional(),
      lowOnly: z.enum(['true', 'false']).optional(),
    }),
  }),
  controller.overview
);
router.get(
  '/inventory/batches',
  validate({
    query: paginationSchema.extend({
      pharmacyId,
      medicineId: z.coerce.number().int().positive().optional(),
      q: z.string().trim().max(120).optional(),
      includeEmpty: z.enum(['true', 'false']).optional(),
    }),
  }),
  controller.batches
);
router.post(
  '/inventory/batches',
  validate({
    body: z.object({
      pharmacyId,
      medicineId: z.coerce.number().int().positive(),
      supplierId: z.coerce.number().int().positive().optional(),
      batchNo: z.string().trim().min(1).max(80),
      expiryDate: dateString,
      quantity: z.coerce.number().int().positive().max(100000),
    }),
  }),
  controller.receive
);
router.patch(
  '/inventory/batches/:id/adjust',
  validate({
    params: idParam,
    body: z.object({
      delta: z.coerce.number().int().refine((v) => v !== 0, 'Enter a non-zero adjustment'),
      reason: z.string().trim().min(2).max(300),
    }),
  }),
  controller.adjust
);
router.get('/inventory/alerts', validate({ query: z.object({ pharmacyId, days: z.coerce.number().int().min(1).max(730).optional() }) }), controller.alerts);

router.get('/suppliers', validate({ query: z.object({ pharmacyId, includeInactive: z.enum(['true', 'false']).optional() }) }), controller.suppliers);
router.post(
  '/suppliers',
  validate({
    body: z.object({
      pharmacyId,
      name: z.string().trim().min(2).max(120),
      contactPerson: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(30).optional(),
      email: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)),
      address: z.string().trim().max(300).optional(),
    }),
  }),
  controller.createSupplier
);
router.patch(
  '/suppliers/:id',
  validate({
    params: idParam,
    body: z.object({
      name: z.string().trim().min(2).max(120),
      contactPerson: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(30).optional(),
      email: z.string().trim().email().optional().or(z.literal('').transform(() => undefined)),
      address: z.string().trim().max(300).optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  controller.updateSupplier
);
router.delete('/suppliers/:id', validate({ params: idParam }), controller.deleteSupplier);

router.get('/purchase-orders', validate({ query: z.object({ pharmacyId, status: z.enum(['draft', 'ordered', 'received', 'cancelled']).optional() }) }), controller.purchaseOrders);
router.get('/purchase-orders/:id', validate({ params: idParam }), controller.purchaseOrder);
router.post(
  '/purchase-orders',
  validate({
    body: z.object({
      pharmacyId,
      supplierId: z.coerce.number().int().positive(),
      items: z
        .array(
          z.object({
            medicineId: z.coerce.number().int().positive(),
            quantityOrdered: z.coerce.number().int().positive().max(100000),
            unitCost: z.coerce.number().min(0).max(100000).default(0),
          })
        )
        .min(1),
    }),
  }),
  controller.createPurchaseOrder
);
router.patch(
  '/purchase-orders/:id/status',
  validate({ params: idParam, body: z.object({ status: z.enum(['ordered', 'cancelled']) }) }),
  controller.updatePurchaseOrderStatus
);
router.post(
  '/purchase-orders/:id/receive',
  validate({
    params: idParam,
    body: z.object({
      items: z
        .array(
          z.object({
            purchaseOrderItemId: z.coerce.number().int().positive(),
            quantityReceived: z.coerce.number().int().positive(),
            batchNo: z.string().trim().min(1).max(80),
            expiryDate: dateString,
          })
        )
        .min(1),
    }),
  }),
  controller.receivePurchaseOrder
);

export default router;
