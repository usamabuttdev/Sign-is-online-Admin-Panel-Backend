const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (d.device_id LIKE @p1 OR d.hardware_type LIKE @p1 OR d.status LIKE @p1)';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM DEVICES d WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        d.id,
        d.device_id,
        ISNULL(l.LOC_TITLE, '') AS location,
        d.hardware_type,
        d.firmware_version,
        d.status,
        d.last_heartbeat,
        d.created_at
      FROM DEVICES d
      LEFT JOIN LOCATION l ON l.LOC_ID = d.location_id
      WHERE ${where}
      ORDER BY d.created_at DESC
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
