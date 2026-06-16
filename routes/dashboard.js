const express = require('express');
const db = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const totalUsers = await db.query('SELECT COUNT(*) FROM users');
    const totalCustomers = await db.query('SELECT COUNT(*) FROM customers');
    const totalBookings = await db.query('SELECT COUNT(*) FROM bookings');
    const totalTransactions = await db.query('SELECT COUNT(*) FROM transactions');
    res.json({
      success: true,
      data: {
        totalUsers: parseInt(totalUsers.rows[0].count),
        totalCustomers: parseInt(totalCustomers.rows[0].count),
        totalBookings: parseInt(totalBookings.rows[0].count),
        totalTransactions: parseInt(totalTransactions.rows[0].count),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user-stats-by-region', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    const result = await db.query('SELECT EXTRACT(MONTH FROM createdat) as month, COUNT(*) as count FROM customers WHERE EXTRACT(YEAR FROM createdat) = $1 GROUP BY month ORDER BY month', [year || new Date().getFullYear()]);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
