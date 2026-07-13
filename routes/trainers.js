const express = require('express');
const db = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, specialization, isActive } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required' });
    const result = await db.query('INSERT INTO trainers (name, email, phone, specialization, isactive, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *', [name, email || null, phone || null, specialization || null, isActive !== undefined ? isActive : true]);
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM trainers WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Trainer not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, specialization, isActive } = req.body;
    const result = await db.query('UPDATE trainers SET name = COALESCE($1, name), email = COALESCE($2, email), phone = COALESCE($3, phone), specialization = COALESCE($4, specialization), isactive = COALESCE($5, isactive), updatedat = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *', [name, email, phone, specialization, isActive, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Trainer not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
