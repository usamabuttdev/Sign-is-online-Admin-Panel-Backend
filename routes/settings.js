const express = require('express');
const db = require('../services/dev-db');

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

router.get('/faqs', async (req, res) => {
  try {
    const result = await db.query("SELECT FAQ_ID, FAQ_QUESTION_TEXT, FAQ_ANSWER_TEXT, FAQ_STATUS, FAQ_DATE_INSERTED, FAQ_DATE_UPDATED FROM FREQUENTLY_ASKED_QUESTION WHERE FAQ_STATUS = 'A' ORDER BY FAQ_ID DESC");
    res.json({ success: true, data: result.rows.map(mapRow) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/privacy-policy', async (req, res) => {
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', ['privacy-policy']);
    res.json({ success: true, data: result.rows[0] || { value: '' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/about-us', async (req, res) => {
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', ['about-us']);
    res.json({ success: true, data: result.rows[0] || { value: '' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/terms-conditions', async (req, res) => {
  try {
    const result = await db.query('SELECT value FROM settings WHERE key = $1', ['terms-conditions']);
    res.json({ success: true, data: result.rows[0] || { value: '' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/update/:id', async (req, res) => {
  try {
    const { value } = req.body;
    const result = await db.query('UPDATE settings SET value = $1, updatedat = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *', [value, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Setting not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
