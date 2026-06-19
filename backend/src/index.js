require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/pool');

const ticketRoutes = require('./routes/tickets');
const kbRoutes = require('./routes/kb');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

app.use('/api/tickets', ticketRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✓ Database connected`);
  } catch (err) {
    console.error(`✗ Database connection failed: ${err.message}`);
  }
  console.log(`✓ Dispatchly API → http://localhost:${PORT}`);
});
