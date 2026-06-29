const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/charges', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (acc.ACC_TITLE LIKE @p1 OR c.CHA_METHOD LIKE @p1)';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM CHARGE c LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        c.CHA_ID AS id,
        ISNULL(acc.ACC_TITLE, '') AS account,
        c.CHA_AMOUNT AS amount,
        ISNULL(c.CHA_METHOD, '') AS method,
        c.CHA_DATE_INSERTED AS created_at,
        CASE WHEN c.CHA_AMOUNT > 0 THEN 'Successful' ELSE 'Attempted' END AS status
      FROM CHARGE c
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID
      WHERE ${where}
      ORDER BY c.CHA_DATE_INSERTED DESC
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

router.get('/charges/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        c.CHA_ID AS id,
        ISNULL(acc.ACC_TITLE, '') AS account,
        c.CHA_AMOUNT AS amount,
        ISNULL(c.CHA_METHOD, '') AS method,
        c.CHA_DATE_INSERTED AS created_at,
        CASE WHEN c.CHA_AMOUNT > 0 THEN 'Successful' ELSE 'Attempted' END AS status
      FROM CHARGE c
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID
      WHERE c.CHA_ID = @p1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
