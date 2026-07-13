const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/scripts', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = "s.SCR_STATUS = 'A'";
    const params = [];
    if (search) {
      where += ' AND s.SCR_TITLE LIKE @p1';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM SCRIPT s WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        s.SCR_ID AS id,
        s.SCR_TITLE AS title,
        s.SCR_RUN_FREQUENCY AS run_frequency,
        s.SCR_DATE_LAST_STARTED AS last_started,
        s.SCR_DATE_INSERTED AS created_at,
        s.SCR_STATUS AS status,
        s.SCR_DATE_LAST_CHECKED AS last_checked,
        s.SCR_TRACK_COUNTS AS track_counts,
        s.SCR_SERVER_NAME AS server_name,
        s.SCR_DESCRIPTION AS description,
        s.SCR_EMAIL_ADDRESS AS email_address,
        s.SCR_CHECK_FREQUENCY AS check_frequency,
        s.SCR_CHECK_RANGE AS check_range,
        s.SCR_DATE_LAST_ALERT AS last_alert,
        s.SCR_FAILURE_INFO AS failure_info
      FROM SCRIPT s
      WHERE ${where}
      ORDER BY s.SCR_DATE_INSERTED DESC
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

router.get('/scripts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        s.SCR_ID AS id,
        s.SCR_TITLE AS title,
        s.SCR_RUN_FREQUENCY AS run_frequency,
        s.SCR_DATE_LAST_STARTED AS last_started,
        s.SCR_DATE_INSERTED AS created_at,
        s.SCR_STATUS AS status,
        s.SCR_DATE_LAST_CHECKED AS last_checked,
        s.SCR_TRACK_COUNTS AS track_counts,
        s.SCR_SERVER_NAME AS server_name,
        s.SCR_DESCRIPTION AS description,
        s.SCR_EMAIL_ADDRESS AS email_address,
        s.SCR_CHECK_FREQUENCY AS check_frequency,
        s.SCR_CHECK_RANGE AS check_range,
        s.SCR_DATE_LAST_ALERT AS last_alert,
        s.SCR_FAILURE_INFO AS failure_info
      FROM SCRIPT s
      WHERE s.SCR_ID = @p1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/scripts/:id/logs', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { pageno = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    const countResult = await devDb.query(
      'SELECT COUNT(*) AS cnt FROM SCRIPT_LOG WHERE SL_SCR_ID = @p1',
      [id]
    );

    const logsQuery = `
      SELECT
        SL_ID AS log_id,
        SL_SCR_ID AS script_id,
        SL_PROCESS_TIME AS process_time,
        SL_PROCESS_COUNT AS process_count,
        SL_DATE_STARTED AS date_started,
        SL_DATE_ENDED AS date_ended,
        SL_LOG_DETAIL AS log_detail,
        SL_SERVER AS server
      FROM SCRIPT_LOG
      WHERE SL_SCR_ID = @p1
      ORDER BY SL_DATE_STARTED DESC, SL_ID DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await devDb.query(logsQuery, [id]);
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

router.post('/scripts', authenticateToken, async (req, res) => {
  try {
    const { title, description, run_frequency, server_name, email_address, check_frequency, check_range, track_counts } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const result = await devDb.query(
      `INSERT INTO SCRIPT (SCR_TITLE, SCR_DESCRIPTION, SCR_RUN_FREQUENCY, SCR_SERVER_NAME, SCR_EMAIL_ADDRESS, SCR_CHECK_FREQUENCY, SCR_CHECK_RANGE, SCR_TRACK_COUNTS, SCR_STATUS, SCR_DATE_INSERTED)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'A', CURRENT_TIMESTAMP) RETURNING SCR_ID AS id, SCR_TITLE AS title`,
      [title, description || null, run_frequency || null, server_name || null, email_address || null, check_frequency || null, check_range || null, track_counts || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/scripts/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, run_frequency, server_name, email_address, check_frequency, check_range, track_counts, status } = req.body;
    const result = await devDb.query(
      `UPDATE SCRIPT SET
        SCR_TITLE = COALESCE($1, SCR_TITLE),
        SCR_DESCRIPTION = COALESCE($2, SCR_DESCRIPTION),
        SCR_RUN_FREQUENCY = COALESCE($3, SCR_RUN_FREQUENCY),
        SCR_SERVER_NAME = COALESCE($4, SCR_SERVER_NAME),
        SCR_EMAIL_ADDRESS = COALESCE($5, SCR_EMAIL_ADDRESS),
        SCR_CHECK_FREQUENCY = COALESCE($6, SCR_CHECK_FREQUENCY),
        SCR_CHECK_RANGE = COALESCE($7, SCR_CHECK_RANGE),
        SCR_TRACK_COUNTS = COALESCE($8, SCR_TRACK_COUNTS),
        SCR_STATUS = COALESCE($9, SCR_STATUS)
       WHERE SCR_ID = $10
       RETURNING SCR_ID AS id, SCR_TITLE AS title`,
      [title || null, description || null, run_frequency || null, server_name || null, email_address || null, check_frequency || null, check_range || null, track_counts !== undefined ? track_counts : null, status || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Script not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
