const express = require('express');
const db = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/contact-us', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (keyword) { where += ` AND (name ILIKE $${idx++} OR email ILIKE $${idx++} OR subject ILIKE $${idx++}`; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    if (status) { where += ` AND status = $${idx++}`; params.push(status); }
    const countResult = await db.query(`SELECT COUNT(*) FROM contact_us ${where}`, params);
    const result = await db.query(`SELECT * FROM contact_us ${where} ORDER BY id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/contact-us/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await db.query('UPDATE contact_us SET status = COALESCE($1, status), updatedat = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/contact-us/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM contact_us WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/support-requests', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (keyword) { where += ` AND (name ILIKE $${idx++} OR email ILIKE $${idx++} OR subject ILIKE $${idx++}`; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
    if (status) { where += ` AND status = $${idx++}`; params.push(status); }
    const countResult = await db.query(`SELECT COUNT(*) FROM support_requests ${where}`, params);
    const result = await db.query(`SELECT * FROM support_requests ${where} ORDER BY id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/support-requests/:id', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await db.query('UPDATE support_requests SET status = COALESCE($1, status), updatedat = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Support request not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/support-requests/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM support_requests WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Support request not found' });
    res.json({ success: true, message: 'Support request deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/trainers', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;
    const where = search ? 'WHERE name ILIKE $1 OR email ILIKE $1' : '';
    const params = search ? [`%${search}%`] : [];
    const countResult = await db.query(`SELECT COUNT(*) FROM trainers ${where}`, params);
    const result = await db.query(`SELECT * FROM trainers ${where} ORDER BY id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(pageno) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
