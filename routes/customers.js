const express = require('express');
const db = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/customers', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;
    const where = search ? 'WHERE name ILIKE $1 OR email ILIKE $1' : '';
    const params = search ? [`%${search}%`] : [];
    const countResult = await db.query(`SELECT COUNT(*) FROM customers ${where}`, params);
    const result = await db.query(`SELECT * FROM customers ${where} ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(pageno) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/customer/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/customer', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const result = await db.query('INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING *', [name, email || null, phone || null]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/customer/edit', authenticateToken, async (req, res) => {
  try {
    const { id, name, email, phone } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'ID required' });
    const result = await db.query('UPDATE customers SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), updatedat = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *', [name, email, phone, id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/customer/status/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await db.query('UPDATE customers SET status = COALESCE($1, status), updatedat = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [status, req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/customer/account/approve/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('UPDATE customers SET accountapproved = true, updatedat = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *', [req.params.id]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/customer/balance/topup_withdrawal', authenticateToken, async (req, res) => {
  try {
    const { customerId, amount, type, description } = req.body;
    if (!customerId || !amount) return res.status(400).json({ success: false, message: 'customerId and amount required' });
    const adjustment = type === 'withdrawal' ? -Math.abs(amount) : Math.abs(amount);
    const customer = await db.query('SELECT * FROM customers WHERE id = $1', [customerId]);
    if (customer.rows.length === 0) return res.status(404).json({ success: false, message: 'Customer not found' });
    const newBalance = parseFloat(customer.rows[0].balance) + adjustment;
    if (newBalance < 0) return res.status(400).json({ success: false, message: 'Insufficient balance' });
    await db.query('UPDATE customers SET balance = $1, updatedat = CURRENT_TIMESTAMP WHERE id = $2', [newBalance, customerId]);
    await db.query('INSERT INTO transactions (customerid, type, amount, description) VALUES ($1, $2, $3, $4)', [customerId, type || 'topup', Math.abs(amount), description || '']);
    res.json({ success: true, message: 'Balance updated', data: { balance: newBalance } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/customer/transactions/history/:id', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;
    const result = await db.query('SELECT * FROM transactions WHERE customerid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3', [req.params.id, limit, offset]);
    const countResult = await db.query('SELECT COUNT(*) FROM transactions WHERE customerid = $1', [req.params.id]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(pageno) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
