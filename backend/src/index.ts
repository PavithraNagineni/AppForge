import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import path from 'path';

import { configurePassport } from './middleware/passport';
import authRoutes from './routes/auth';
import appsRoutes from './routes/apps';
import recordsRoutes from './routes/records';
import csvRoutes from './routes/csv';
import notificationsRoutes from './routes/notifications';
import exportRoutes from './routes/export';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security & Middleware ──────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Passport
configurePassport();
app.use(passport.initialize());

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/apps', appsRoutes);
app.use('/api/apps', recordsRoutes);
app.use('/api/apps', csvRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/export', exportRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Global error handler
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');

    app.listen(PORT, () => {
      console.log(`🚀 AppForge backend running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start:', err);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
