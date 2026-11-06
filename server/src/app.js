import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import memberRoutes from './routes/members.js';
import planRoutes from './routes/plans.js';
import membershipRoutes from './routes/memberships.js';
import paymentRoutes from './routes/payments.js';
import attendanceRoutes from './routes/attendance.js';
import inventoryRoutes from './routes/inventory.js';
import equipmentRoutes from './routes/equipment.js';
import memberPortalRoutes from './routes/memberPortal.js';
import equipmentPlanRoutes from './routes/equipmentPlans.js';
import equipmentSubscriptionRoutes from './routes/equipmentSubscriptions.js';
import settingsRoutes from './routes/settings.js';
import { db } from './database/connection.js';
export const createApp = () => {
  const app = express(),
    allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: '1mb' }));
  app.get('/api/health', async (_req, res) => {
    try {
      await db().query('SELECT 1');
      res.json({ status: 'ok', database: 'mysql' });
    } catch {
      res.status(503).json({ status: 'database unavailable' });
    }
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/members', memberRoutes);
  app.use('/api/plans', planRoutes);
  app.use('/api/equipment-plans', equipmentPlanRoutes);
  app.use('/api/equipment-subscriptions', equipmentSubscriptionRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/memberships', membershipRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/equipment', equipmentRoutes);
  app.use('/api/member', memberPortalRoutes);
  app.use((err, _req, res, _next) => {
    console.error(err.stack || err);
    res.status(500).json({ message: 'Something went wrong!' });
  });
  return app;
};
