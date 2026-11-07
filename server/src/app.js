import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { config, PROJECT_ROOT } from './config.js';
import { getDb } from './db/index.js';
import { ensureCsrfCookie, csrfProtection } from './middleware/csrf.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import catalogueRoutes from './routes/catalogue.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import prescriptionRoutes from './routes/prescriptions.js';
import paymentRoutes from './routes/payments.js';
import inventoryRoutes from './routes/inventory.js';
import dashboardRoutes from './routes/dashboard.js';
import deliveryRoutes from './routes/delivery.js';
import refillRoutes from './routes/refills.js';
import adminRoutes from './routes/admin.js';
import devRoutes from './routes/dev.js';
import analyticsRoutes from './routes/analytics.js';
import reportRoutes from './routes/reports.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  if (!config.isTest) app.use(morgan(config.isProduction ? 'combined' : 'dev'));

  app.use(ensureCsrfCookie);
  app.use('/api', apiLimiter, csrfProtection);

  app.get('/api/health', (_req, res) => {
    getDb().prepare('SELECT 1 AS ok').get();
    res.json({
      status: 'ok',
      service: 'pharmalink-api',
      version: '1.0.0',
      time: new Date().toISOString(),
      uptime_seconds: Math.round(process.uptime()),
      database: 'ok',
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/cart', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api', catalogueRoutes);
  app.use('/api', prescriptionRoutes);
  app.use('/api', paymentRoutes);
  app.use('/api', inventoryRoutes);
  app.use('/api', deliveryRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/refills', refillRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/dev', devRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/reports', reportRoutes);

  app.use('/api', notFoundHandler);

  // In production the Vite build is served by Express (single origin, HTTPS
  // terminated by the reverse proxy).
  if (config.isProduction) {
    const dist = path.join(PROJECT_ROOT, 'client/dist');
    app.use(express.static(dist, { maxAge: '1d' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
