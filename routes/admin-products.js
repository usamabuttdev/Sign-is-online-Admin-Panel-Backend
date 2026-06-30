const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/products', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = "p.PRO_STATUS = 'A'";
    const params = [];
    if (search) {
      where += ' AND p.PRO_TITLE LIKE @p1';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM PRODUCT p WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        p.PRO_ID AS id,
        p.PRO_TITLE AS title,
        p.PRO_SUBSCRIPTION_LENGTH AS subscription_length,
        CASE WHEN p.PRO_STATUS = 'A' THEN 'Yes' ELSE 'No' END AS status,
        p.PRO_DATE_INSERTED AS created_at
      FROM PRODUCT p
      WHERE ${where}
      ORDER BY p.PRO_DATE_INSERTED DESC
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

module.exports = router;
