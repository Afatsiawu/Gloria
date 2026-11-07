import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const skip = () => config.isTest;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many attempts. Please wait 15 minutes and try again.',
      details: [],
    },
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please slow down.',
      details: [],
    },
  },
});
