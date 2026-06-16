const express = require('express');
const db = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/all-users', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const countParams = [];
    if (keyword) { where += ' AND (Email LIKE $1 OR FullName LIKE $1)'; countParams.push(`%${keyword}%`); }
    const countResult = await db.query(`SELECT COUNT(*) as cnt FROM USR ${where}`, countParams);
    const total = countResult.rows.length > 0 ? parseInt(countResult.rows[0].cnt) : 0;
    const dataParams = keyword ? [`%${keyword}%`, parseInt(limit), offset] : [parseInt(limit), offset];
    const dataSQL = keyword
      ? 'SELECT UserID as id, COALESCE(FullName, Email) as name, Email as email, Role as role, CreatedAt as createdat FROM USR WHERE Email LIKE $1 OR FullName LIKE $1 ORDER BY CreatedAt DESC LIMIT $2 OFFSET $3'
      : 'SELECT UserID as id, COALESCE(FullName, Email) as name, Email as email, Role as role, CreatedAt as createdat FROM USR WHERE 1=1 ORDER BY CreatedAt DESC LIMIT $1 OFFSET $2';
    const result = await db.query(dataSQL, dataParams);
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
    await db.query('UPDATE USR SET isactive = $1, updatedat = CURRENT_TIMESTAMP WHERE id = $2', [isActive, req.params.id]);
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
