const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/apis', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (a.API_TITLE LIKE @p1 OR a.API_DESCRIPTION LIKE @p1)';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM API_ENDPOINTS a WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        a.API_ID AS id,
        a.API_TITLE AS title,
        a.API_DESCRIPTION AS description,
        a.API_CALLS_24H AS calls_24h,
        a.API_CALLS_1H AS calls_1h,
        a.API_QUEUED AS queued_count,
        a.API_CREATED_AT AS created_at
      FROM API_ENDPOINTS a
      WHERE ${where}
      ORDER BY a.API_CREATED_AT DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await devDb.query(listQuery, params);
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].cnt),
      page: parseInt(pageno),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/apis/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      'SELECT API_ID AS id, API_TITLE AS title, API_DESCRIPTION AS description FROM API_ENDPOINTS WHERE API_ID = @p1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'API not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
