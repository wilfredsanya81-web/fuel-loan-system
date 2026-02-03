import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import ridersRoutes from './routes/riders.js';
import loansRoutes from './routes/loans.js';
import dashboardRoutes from './routes/dashboard.js';
import momoRoutes from './routes/momo.js';
import callbacksRoutes from './routes/callbacks.js';
import { startPenaltyCron } from './cron/penaltyJob.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters in production.');
  process.exit(1);
}

const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors({
  origin: corsOrigin ? corsOrigin.split(',').map((o) => o.trim()) : true,
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/riders', ridersRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/momo', momoRoutes);
app.use('/api/callbacks', callbacksRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

startPenaltyCron();

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
});
