import { Router } from 'express';
import * as controller from '../controllers/dashboardController.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.get('/', authenticate, requireRole('pharmacist', 'admin'), controller.get);
export default router;
