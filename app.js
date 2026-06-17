const express = require('express');
require('dotenv').config();
const cors = require('cors');
const initializeSchema = require('./schema');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/admin', require('./routes/users'));
app.use('/admin', require('./routes/dashboard'));
app.use('/admin/faqs', require('./routes/faqs'));

const { adminRouter: bookingsAdmin, publicRouter: bookingsPublic } = require('./routes/bookings');
app.use('/admin/bookings', bookingsAdmin);
app.use('/bookings', bookingsPublic);

const adminRouter = require('./routes/admin');
app.use('/admin', adminRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin', require('./routes/customers'));

app.use('/specializations', require('./routes/specializations'));
app.use('/training-modes', require('./routes/trainingModes'));
app.use('/languages', require('./routes/languages'));
app.use('/settings', require('./routes/settings'));
app.use('/transactions', require('./routes/transactions'));
app.use('/upload', require('./routes/upload'));
app.use('/communications', require('./routes/communications'));
app.use('/products', require('./routes/productViews'));
app.use('/products', require('./routes/productMetrics'));
app.use('/products', require('./routes/products'));
app.use('/sales', require('./routes/sales'));
app.use('/trainers', require('./routes/trainers'));

app.get('/', (req, res) => {
  res.send('Welcome to our boilerplate Expressjs server');
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
  try {
    await initializeSchema();
  } catch (err) {
    console.warn('Local database schema init skipped (dev API in use):', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();

module.exports = app;
