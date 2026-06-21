require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./db/pool');

const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const kbRoutes = require('./routes/kb');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const catalogRoutes = require('./routes/catalog');
const emailRoutes = require('./routes/email');

const emailPoller = require('./services/emailPoller');
const slaMonitor = require('./services/slaMonitor');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/email', emailRoutes);

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✓ Database connected`);
  } catch (err) {
    console.error(`✗ Database connection failed: ${err.message}`);
  }
  console.log(`✓ Dispatchly API → http://localhost:${PORT}`);

  // Start background services
  slaMonitor.start();
  emailPoller.start();
});
