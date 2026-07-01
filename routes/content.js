const express = require('express');
const db = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const VALID_TITLES = ['privacy-policy', 'about-us', 'terms-conditions'];

router.get('/content/:title', async (req, res) => {
  try {
    const { title } = req.params;
    if (!VALID_TITLES.includes(title)) {
      return res.status(400).json({ success: false, message: 'Invalid content title' });
    }
    const result = await db.query(
      'SELECT CON_ID AS id, CON_TITLE AS title, CON_HTML AS html, CON_DATE_INSERTED AS dateInserted, CON_DATE_UPDATED AS dateUpdated FROM CONTENT WHERE CON_TITLE = $1',
      [title]
    );
    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/content/:title', authenticateToken, async (req, res) => {
  try {
    const { title } = req.params;
    if (!VALID_TITLES.includes(title)) {
      return res.status(400).json({ success: false, message: 'Invalid content title' });
    }
    const { html } = req.body;
    if (!html || typeof html !== 'string') {
      return res.status(400).json({ success: false, message: 'HTML content is required' });
    }
    const existing = await db.query(
      'SELECT CON_ID FROM CONTENT WHERE CON_TITLE = $1',
      [title]
    );
    if (existing.rows.length > 0) {
      const result = await db.query(
        'UPDATE CONTENT SET CON_HTML = $1, CON_DATE_UPDATED = CURRENT_TIMESTAMP WHERE CON_TITLE = $2',
        [html, title]
      );
      const updated = await db.query(
        'SELECT CON_ID AS id, CON_TITLE AS title, CON_HTML AS html, CON_DATE_INSERTED AS dateInserted, CON_DATE_UPDATED AS dateUpdated FROM CONTENT WHERE CON_TITLE = $1',
        [title]
      );
      res.json({ success: true, data: updated.rows[0] });
    } else {
      const result = await db.query(
        'INSERT INTO CONTENT (CON_TITLE, CON_HTML) VALUES ($1, $2)',
        [title, html]
      );
      const created = await db.query(
        'SELECT CON_ID AS id, CON_TITLE AS title, CON_HTML AS html, CON_DATE_INSERTED AS dateInserted, CON_DATE_UPDATED AS dateUpdated FROM CONTENT WHERE CON_TITLE = $1',
        [title]
      );
      res.json({ success: true, data: created.rows[0] });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
