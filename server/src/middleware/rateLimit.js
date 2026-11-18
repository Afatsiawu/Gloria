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

/** Guest checkout creates stock reservations, so keep this tighter than the API default. */
export const guestOrderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many guest orders from this device. Please wait a few minutes and try again.',
      details: [],
    },
  },
});

/** Reference + phone lookups are guessable in theory, so limit them strictly. */
export const trackLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many tracking attempts. Please wait a few minutes and try again.',
      details: [],
    },
  },
});
