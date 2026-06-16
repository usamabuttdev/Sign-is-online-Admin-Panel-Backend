const express = require('express');
const db = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', isActive } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (keyword) { where += ` AND (question ILIKE $${idx++} OR answer ILIKE $${idx++}`; params.push(`%${keyword}%`, `%${keyword}%`); }
    if (isActive !== undefined && isActive !== '') { where += ` AND isactive = $${idx++}`; params.push(isActive === 'true'); }
    const countResult = await db.query(`SELECT COUNT(*) FROM faqs ${where}`, params);
    const result = await db.query(`SELECT * FROM faqs ${where} ORDER BY id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/all', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', isActive } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (keyword) { where += ` AND (question ILIKE $${idx++} OR answer ILIKE $${idx++}`; params.push(`%${keyword}%`, `%${keyword}%`); }
    if (isActive !== undefined && isActive !== '') { where += ` AND isactive = $${idx++}`; params.push(isActive === 'true'); }
    const countResult = await db.query(`SELECT COUNT(*) FROM faqs ${where}`, params);
    const result = await db.query(`SELECT * FROM faqs ${where} ORDER BY id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ success: false, message: 'Question and answer required' });
    const result = await db.query('INSERT INTO faqs (question, answer) VALUES ($1, $2) RETURNING *', [question, answer]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { question, answer, isActive } = req.body;
    const result = await db.query('UPDATE faqs SET question = COALESCE($1, question), answer = COALESCE($2, answer), isactive = COALESCE($3, isactive), updatedat = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *', [question, answer, isActive, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'FAQ not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM faqs WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'FAQ not found' });
    res.json({ success: true, message: 'FAQ deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
