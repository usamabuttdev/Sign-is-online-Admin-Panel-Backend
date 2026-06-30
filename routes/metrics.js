const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/metrics', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = "m.MET_STATUS = 'A'";
    const params = [];
    if (search) {
      where += ' AND m.MET_TITLE LIKE @p1';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM METRIC m WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        m.MET_ID AS id,
        m.MET_TITLE AS title,
        m.MET_RUN_FREQUENCY AS frequency,
        mv.MV_VALUE AS current_value,
        m.MET_GOAL AS goal,
        mv.MV_PCT_OF_GOAL AS percent_of_goal,
        m.MET_DATE_INSERTED AS created_at,
        m.MET_UNITS AS met_units,
        m.MET_DIRECTION AS direction,
        m.MET_DESCRIPTION AS description
      FROM METRIC m
      LEFT JOIN (
        SELECT MV_MET_ID, MV_VALUE, MV_PCT_OF_GOAL, MV_DATE,
          ROW_NUMBER() OVER (PARTITION BY MV_MET_ID ORDER BY MV_DATE DESC, MV_ID DESC) AS rn
        FROM METRIC_VALUE
      ) mv ON mv.MV_MET_ID = m.MET_ID AND mv.rn = 1
      WHERE ${where}
      ORDER BY m.MET_DATE_INSERTED DESC
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

router.get('/metrics/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        m.MET_ID AS id,
        m.MET_TITLE AS title,
        m.MET_QUERY AS [query],
        m.MET_RUN_FREQUENCY AS frequency,
        mv.MV_VALUE AS current_value,
        m.MET_GOAL AS goal,
        mv.MV_PCT_OF_GOAL AS percent_of_goal,
        m.MET_DATE_INSERTED AS created_at,
        m.MET_UNITS AS met_units,
        m.MET_DIRECTION AS direction,
        m.MET_DESCRIPTION AS description
      FROM METRIC m
      LEFT JOIN (
        SELECT MV_MET_ID, MV_VALUE, MV_PCT_OF_GOAL, MV_DATE,
          ROW_NUMBER() OVER (PARTITION BY MV_MET_ID ORDER BY MV_DATE DESC, MV_ID DESC) AS rn
        FROM METRIC_VALUE
      ) mv ON mv.MV_MET_ID = m.MET_ID AND mv.rn = 1
      WHERE m.MET_ID = @p1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Metric not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/metrics/:id/values', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { pageno = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    const countResult = await devDb.query(
      'SELECT COUNT(*) AS cnt FROM METRIC_VALUE WHERE MV_MET_ID = @p1',
      [id]
    );

    const valuesQuery = `
      SELECT
        MV_ID AS id,
        MV_VALUE AS value,
        MV_PCT_OF_GOAL AS percent_of_goal,
        MV_DATE AS date,
        MV_DATE_UPDATED AS updated_at
      FROM METRIC_VALUE
      WHERE MV_MET_ID = @p1
      ORDER BY MV_DATE DESC, MV_ID DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await devDb.query(valuesQuery, [id]);
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
