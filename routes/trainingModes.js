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
    if (keyword) { where += ` AND name ILIKE $${idx++}`; params.push(`%${keyword}%`); }
    if (isActive !== undefined && isActive !== '') { where += ` AND isactive = $${idx++}`; params.push(isActive === 'true'); }
    const countResult = await db.query(`SELECT COUNT(*) FROM training_modes ${where}`, params);
    const result = await db.query(`SELECT * FROM training_modes ${where} ORDER BY id DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const result = await db.query('INSERT INTO training_modes (name) VALUES ($1) RETURNING *', [name]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const result = await db.query('UPDATE training_modes SET name = COALESCE($1, name), isactive = COALESCE($2, isactive), updatedat = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *', [name, isActive, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Training mode not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM training_modes WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Training mode not found' });
    res.json({ success: true, message: 'Training mode deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
