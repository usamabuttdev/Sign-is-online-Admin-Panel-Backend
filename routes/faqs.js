const express = require('express');
const db = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.FAQ_ID,
    question: row.FAQ_QUESTION_TEXT,
    answer: row.FAQ_ANSWER_TEXT,
    public: row.FAQ_STATUS === 'A' ? 1 : 0,
    createdAt: row.FAQ_DATE_INSERTED,
    updatedAt: row.FAQ_DATE_UPDATED,
  };
}

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', isActive } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (keyword) { where += ` AND (FAQ_QUESTION_TEXT ILIKE $${idx++} OR FAQ_ANSWER_TEXT ILIKE $${idx++}`; params.push(`%${keyword}%`, `%${keyword}%`); }
    if (isActive !== undefined && isActive !== '') { where += ` AND FAQ_STATUS = $${idx++}`; params.push(isActive === 'true' ? 'A' : 'I'); }
    const countResult = await db.query(`SELECT COUNT(*) AS cnt FROM FREQUENTLY_ASKED_QUESTION ${where}`, params);
    const result = await db.query(`SELECT FAQ_ID, FAQ_QUESTION_TEXT, FAQ_ANSWER_TEXT, FAQ_STATUS, FAQ_DATE_INSERTED, FAQ_DATE_UPDATED FROM FREQUENTLY_ASKED_QUESTION ${where} ORDER BY FAQ_ID DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows.map(mapRow), total: parseInt(countResult.rows[0].cnt), page: parseInt(page) });
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
    if (keyword) { where += ` AND (FAQ_QUESTION_TEXT ILIKE $${idx++} OR FAQ_ANSWER_TEXT ILIKE $${idx++}`; params.push(`%${keyword}%`, `%${keyword}%`); }
    if (isActive !== undefined && isActive !== '') { where += ` AND FAQ_STATUS = $${idx++}`; params.push(isActive === 'true' ? 'A' : 'I'); }
    const countResult = await db.query(`SELECT COUNT(*) AS cnt FROM FREQUENTLY_ASKED_QUESTION ${where}`, params);
    const result = await db.query(`SELECT FAQ_ID, FAQ_QUESTION_TEXT, FAQ_ANSWER_TEXT, FAQ_STATUS, FAQ_DATE_INSERTED, FAQ_DATE_UPDATED FROM FREQUENTLY_ASKED_QUESTION ${where} ORDER BY FAQ_ID DESC LIMIT $${idx} OFFSET $${idx+1}`, [...params, parseInt(limit), offset]);
    res.json({ success: true, data: result.rows.map(mapRow), total: parseInt(countResult.rows[0].cnt), page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { question, answer, isActive } = req.body;
    if (!question || !answer) return res.status(400).json({ success: false, message: 'Question and answer required' });
    const status = isActive !== undefined ? (isActive ? 'A' : 'I') : 'A';
    const result = await db.query('INSERT INTO FREQUENTLY_ASKED_QUESTION (FAQ_QUESTION_TEXT, FAQ_ANSWER_TEXT, FAQ_STATUS, FAQ_DATE_INSERTED, FAQ_DATE_UPDATED) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *', [question, answer, status]);
    res.status(201).json({ success: true, data: mapRow(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { question, answer, isActive } = req.body;
    const status = isActive !== undefined ? (isActive ? 'A' : 'I') : undefined;
    const params = [question || null, answer || null, status || null, req.params.id];
    const result = await db.query('UPDATE FREQUENTLY_ASKED_QUESTION SET FAQ_QUESTION_TEXT = COALESCE($1, FAQ_QUESTION_TEXT), FAQ_ANSWER_TEXT = COALESCE($2, FAQ_ANSWER_TEXT), FAQ_STATUS = COALESCE($3, FAQ_STATUS), FAQ_DATE_UPDATED = CURRENT_TIMESTAMP WHERE FAQ_ID = $4 RETURNING *', params);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'FAQ not found' });
    res.json({ success: true, data: mapRow(result.rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM FREQUENTLY_ASKED_QUESTION WHERE FAQ_ID = $1 RETURNING FAQ_ID', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'FAQ not found' });
    res.json({ success: true, message: 'FAQ deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
