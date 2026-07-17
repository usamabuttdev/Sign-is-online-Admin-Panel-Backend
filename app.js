const express = require('express');
require('dotenv').config();
const cors = require('cors');
const initializeSchema = require('./schema');
const initializeContentSchema = require('./services/content-schema');
const initializeApiEndpointsSchema = require('./services/api-endpoints-schema');
const initializeChargeSchema = require('./services/charge-schema');
const initializeUsersSchema = require('./services/users-schema');

const app = express();
app.set('etag', false);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Auth (public) — keep both prefixes for compatibility
app.use('/auth', require('./routes/auth'));
app.use('/api/auth', require('./routes/auth'));

// Canonical admin API prefix
const adminMounts = (prefix) => {
  app.use(prefix, require('./routes/users'));
  app.use(prefix, require('./routes/dashboard'));
  app.use(`${prefix}/faqs`, require('./routes/faqs'));

  const { adminRouter: bookingsAdmin } = require('./routes/bookings');
  app.use(`${prefix}/bookings`, bookingsAdmin);

  const adminRouter = require('./routes/admin');
  app.use(prefix, adminRouter);
  app.use(prefix, require('./routes/content'));
  app.use(prefix, require('./routes/customers'));
  app.use(prefix, require('./routes/accounts'));
  app.use(prefix, require('./routes/charges'));
  app.use(prefix, require('./routes/locations'));
  app.use(prefix, require('./routes/platforms'));
  app.use(prefix, require('./routes/admin-products'));
  app.use(prefix, require('./routes/metrics'));
  app.use(prefix, require('./routes/scripts'));
  app.use(prefix, require('./routes/devices'));
  app.use(prefix, require('./routes/history'));
  app.use(prefix, require('./routes/apis'));
  app.use(`${prefix}/sales`, require('./routes/sales'));
  app.use(`${prefix}/trainers`, require('./routes/trainers'));
  app.use(`${prefix}/specializations`, require('./routes/specializations'));
  app.use(`${prefix}/training-modes`, require('./routes/trainingModes'));
  app.use(`${prefix}/languages`, require('./routes/languages'));
  app.use(`${prefix}/transactions`, require('./routes/transactions'));
};

adminMounts('/api/admin');
// Temporary aliases — prefer /api/admin from clients
adminMounts('/admin');

const { publicRouter: bookingsPublic } = require('./routes/bookings');
app.use('/bookings', bookingsPublic);

app.use('/settings', require('./routes/settings'));
app.use('/upload', require('./routes/upload'));
app.use('/communications', require('./routes/communications'));

// PRODUCT table only — legacy lowercase `products` routes removed
const noProductCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
};
app.use('/api/product', noProductCache, require('./routes/product'));

app.get('/', (req, res) => {
  res.send('Sign-is-online Admin API');
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

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

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
  try {
    await initializeApiEndpointsSchema();
  } catch (err) {
    console.warn('MSSQL API_ENDPOINTS schema init failed:', err.message);
  }
  try {
    await initializeChargeSchema();
  } catch (err) {
    console.warn('MSSQL CHARGE schema init failed:', err.message);
  }
  try {
    await initializeUsersSchema();
  } catch (err) {
    console.warn('MSSQL Users schema init failed:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();

module.exports = app;
