const express = require('express');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;
    const where = search ? 'WHERE name ILIKE $1 OR email ILIKE $1' : '';
    const params = search ? [`%${search}%`] : [];
    const countResult = await db.query(`SELECT COUNT(*) FROM transactions ${where}`, params);
    const result = await db.query(`SELECT t.*, c.name as customerName FROM transactions t LEFT JOIN customers c ON t.customerid = c.id ${where} ORDER BY t.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(pageno) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
