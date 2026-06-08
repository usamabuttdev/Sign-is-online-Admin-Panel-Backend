const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const adminRouter = express.Router();
const publicRouter = express.Router();

adminRouter.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', isActive } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (keyword) { where += ` AND title ILIKE $${idx++}`; params.push(`%${keyword}%`); }
    if (isActive !== undefined && isActive !== '') { where += ` AND isactive = $${idx++}`; params.push(isActive === 'true'); }
    const countResult = await db.query(`SELECT COUNT(*) FROM bookings ${where}`, params);
    const result = await db.query(`SELECT b.*, c.name as customername FROM bookings b LEFT JOIN customers c ON b.userid = c.id ${where} ORDER BY b.id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

publicRouter.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT b.*, c.name as customername FROM bookings b LEFT JOIN customers c ON b.userid = c.id WHERE b.id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = { adminRouter, publicRouter };
