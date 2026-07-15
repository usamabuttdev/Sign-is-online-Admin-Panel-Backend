const express = require('express');
require('dotenv').config();
const cors = require('cors');
const initializeSchema = require('./schema');
const initializeContentSchema = require('./services/content-schema');

const app = express();
app.set('etag', false);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/auth'));
app.use('/admin', require('./routes/users'));
app.use('/admin', require('./routes/dashboard'));
app.use('/admin/faqs', require('./routes/faqs'));

const { adminRouter: bookingsAdmin, publicRouter: bookingsPublic } = require('./routes/bookings');
app.use('/admin/bookings', bookingsAdmin);
app.use('/bookings', bookingsPublic);

const adminRouter = require('./routes/admin');
app.use('/admin', adminRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', require('./routes/content'));
app.use('/api/admin', require('./routes/customers'));
app.use('/api/admin', require('./routes/accounts'));
app.use('/api/admin', require('./routes/charges'));
app.use('/api/admin', require('./routes/locations'));
app.use('/api/admin', require('./routes/users'));
app.use('/api/admin', require('./routes/platforms'));
app.use('/api/admin', require('./routes/admin-products'));
app.use('/api/admin', require('./routes/metrics'));
app.use('/api/admin', require('./routes/scripts'));
app.use('/api/admin', require('./routes/devices'));
app.use('/api/admin', require('./routes/history'));
app.use('/api/admin', require('./routes/apis'));

app.use('/specializations', require('./routes/specializations'));
app.use('/training-modes', require('./routes/trainingModes'));
app.use('/languages', require('./routes/languages'));
app.use('/settings', require('./routes/settings'));
app.use('/transactions', require('./routes/transactions'));
app.use('/upload', require('./routes/upload'));
app.use('/communications', require('./routes/communications'));
const noProductCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};

app.use('/products', noProductCache, require('./routes/productViews'));
app.use('/products', noProductCache, require('./routes/productMetrics'));
app.use('/products', noProductCache, require('./routes/products'));
app.use('/sales', require('./routes/sales'));
app.use('/trainers', require('./routes/trainers'));

app.get('/', (req, res) => {
  res.send('Welcome to our boilerplate Expressjs server');
});

app.get('/diagnostics', async (req, res) => {
  const results = { mssql: { connect: false, query: false } };
  try {
    const db = require('./db');
    await db.getPool();
    results.mssql.connect = true;
    try {
      const q = await db.query('SELECT 1 AS ok');
      results.mssql.query = q.rows.length > 0;
    } catch (e) {
      results.mssql.queryError = e.message;
    }
  } catch (e) {
    results.mssql.connectError = e.message;
  }
  res.json({ success: true, data: results });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is healthy!' });
});

// 404 handler — return JSON instead of HTML
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler — return JSON instead of Express's default HTML
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

async function start() {
  await initializeSchema();
  try {
    await initializeContentSchema();
  } catch (err) {
    console.warn('MSSQL CONTENT schema init failed:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();

module.exports = app;
