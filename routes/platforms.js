const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/platforms', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = "p.PLA_STATUS = 'A'";
    const params = [];
    if (search) {
      where += ' AND p.PLA_TITLE LIKE @p1';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM PLATFORM p WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        p.PLA_ID AS id,
        p.PLA_TITLE AS title,
        CASE WHEN p.PLA_STATUS = 'A' THEN 'Yes' ELSE 'No' END AS available,
        ISNULL(lpm.connected_count, 0) AS connected_count,
        p.PLA_DATE_INSERTED AS created_at
      FROM PLATFORM p
      LEFT JOIN (
        SELECT LPM_PLA_ID, COUNT(*) AS connected_count
        FROM LOCATION_PLATFORM_MAP
        WHERE LPM_STATUS = 'A'
        GROUP BY LPM_PLA_ID
      ) lpm ON lpm.LPM_PLA_ID = p.PLA_ID
      WHERE ${where}
      ORDER BY p.PLA_DATE_INSERTED DESC
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

router.get('/platforms/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        p.PLA_ID AS id,
        p.PLA_TITLE AS title,
        CASE WHEN p.PLA_STATUS = 'A' THEN 'Yes' ELSE 'No' END AS available,
        ISNULL(lpm.connected_count, 0) AS connected_count,
        p.PLA_DATE_INSERTED AS created_at
      FROM PLATFORM p
      LEFT JOIN (
        SELECT LPM_PLA_ID, COUNT(*) AS connected_count
        FROM LOCATION_PLATFORM_MAP
        WHERE LPM_STATUS = 'A'
        GROUP BY LPM_PLA_ID
      ) lpm ON lpm.LPM_PLA_ID = p.PLA_ID
      WHERE p.PLA_ID = @p1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Platform not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
