import { Router } from 'express';
import { z } from 'zod';
import * as controller from '../controllers/authController.js';
import { validate } from '../utils/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { isValidGhanaPhone } from '../utils/phone.js';

const router = Router();

const phone = z.string().trim().min(1, 'Phone number is required').refine(isValidGhanaPhone, {
  message: 'Enter a valid Ghana mobile number, for example 024 123 4567',
});
const password = z.string().min(8, 'Password must be at least 8 characters');
const email = z
  .string()
  .trim()
  .email('Enter a valid email address')
  .optional()
  .or(z.literal('').transform(() => undefined));
const digitalAddress = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}-\d{3}-\d{4}$/, 'Use a Ghana Post GPS code such as GA-123-4567')
  .optional()
  .or(z.literal('').transform(() => undefined));
const community = z.enum(['Doryumu', 'Kordibe']);

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
  phone,
  email,
  password,
  community,
  deliveryAddress: z.string().trim().max(300).optional(),
  digitalAddressCode: digitalAddress,
  consent: z.boolean().refine((v) => v === true, 'You must consent to data processing to register'),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'Enter your phone number or email'),
  password: z.string().min(1, 'Enter your password'),
});

const forgotSchema = z.object({
  identifier: z.string().trim().min(3),
  channel: z.enum(['sms', 'email']).optional(),
});

const resetSchema = z.object({
  identifier: z.string().trim().min(3),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password,
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email,
  community,
  deliveryAddress: z.string().trim().max(300).optional(),
  digitalAddressCode: digitalAddress,
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
});

router.get('/csrf', controller.csrf);
router.post('/register', authLimiter, validate({ body: registerSchema }), controller.register);
router.post('/login', authLimiter, validate({ body: loginSchema }), controller.login);
router.post('/logout', controller.logout);
router.post('/forgot-password', authLimiter, validate({ body: forgotSchema }), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate({ body: resetSchema }), controller.resetPassword);
router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, validate({ body: profileSchema }), controller.updateProfile);
router.patch(
  '/me/password',
  authenticate,
  validate({ body: passwordChangeSchema }),
  controller.changePassword
);
router.get('/me/data', authenticate, controller.exportData);
router.post('/me/delete-request', authenticate, controller.requestDeletion);
router.get('/me/notifications', authenticate, controller.myNotifications);

export default router;
