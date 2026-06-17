const express = require('express');
const db = require('../db');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/all-users', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let countSQL = 'SELECT COUNT(*) as cnt FROM users';
    let dataSQL = 'SELECT UserID as id, FullName as name, Email as email, Phone as phone, Role as role, CreatedAt as createdat FROM users';
    const countParams = [];
    if (keyword) {
      const clause = ' WHERE (FullName ILIKE $1 OR Email ILIKE $1)';
      countSQL += clause;
      dataSQL += clause;
      countParams.push(`%${keyword}%`);
    }
    const countResult = await devDb.query(countSQL, countParams);
    const total = countResult.rows.length > 0 ? parseInt(countResult.rows[0].cnt) : 0;
    const hasKW = !!keyword;
    const dataParams = hasKW ? [`%${keyword}%`, parseInt(limit), offset] : [parseInt(limit), offset];
    dataSQL += ' ORDER BY CreatedAt DESC LIMIT $' + (hasKW ? 2 : 1) + ' OFFSET $' + (hasKW ? 3 : 2);
    const result = await devDb.query(dataSQL, dataParams);
    res.json({ success: true, data: result.rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/listings-by-user/:id', authenticateToken, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page) - 1) * limit;
    const result = await db.query('SELECT * FROM bookings WHERE userid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3', [req.params.id, limit, offset]);
    const countResult = await db.query('SELECT COUNT(*) FROM bookings WHERE userid = $1', [req.params.id]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/users/:id/account-state', authenticateToken, async (req, res) => {
  try {
    const { isActive } = req.body;
    await devDb.query('UPDATE users SET isactive = $1, updatedat = CURRENT_TIMESTAMP WHERE id = $2', [isActive, req.params.id]);
    res.json({ success: true, message: 'User status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user-bookings/:id', authenticateToken, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page) - 1) * limit;
    const result = await db.query('SELECT * FROM bookings WHERE userid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3', [req.params.id, limit, offset]);
    const countResult = await db.query('SELECT COUNT(*) FROM bookings WHERE userid = $1', [req.params.id]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user-rentals/:id', authenticateToken, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page) - 1) * limit;
    const result = await db.query('SELECT * FROM bookings WHERE userid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3', [req.params.id, limit, offset]);
    const countResult = await db.query('SELECT COUNT(*) FROM bookings WHERE userid = $1', [req.params.id]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user-earnings/:id', authenticateToken, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page) - 1) * limit;
    const result = await db.query('SELECT * FROM transactions WHERE customerid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3', [req.params.id, limit, offset]);
    const countResult = await db.query('SELECT COUNT(*) FROM transactions WHERE customerid = $1', [req.params.id]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/documents-verification', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = "WHERE 1=1";
    const params = [];
    let idx = 1;
    if (keyword) { where += ` AND name ILIKE $${idx++}`; params.push(`%${keyword}%`); }
    if (status) { where += ` AND status = $${idx++}`; params.push(status); }
    const countResult = await db.query(`SELECT COUNT(*) FROM customers ${where}`, params);
    const result = await db.query(`SELECT * FROM customers ${where} ORDER BY id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/documents/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query('UPDATE customers SET status = $1, updatedat = CURRENT_TIMESTAMP WHERE id = $2', [status, req.params.id]);
    res.json({ success: true, message: 'Document status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
