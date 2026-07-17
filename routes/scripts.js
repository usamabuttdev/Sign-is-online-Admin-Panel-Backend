const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');
const { syncSequence } = require('../services/sequences-schema');

const router = express.Router();

/** SCR_RUN_FREQUENCY char(1): D/W/M/H/N/Y/Q */
function normalizeRunFrequency(value, { defaultValue = null } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const raw = String(value).trim().toUpperCase();
  if (raw.length === 1 && 'DWMHNQY'.includes(raw)) return raw;
  if (raw.startsWith('DAY') || raw === 'DAILY') return 'D';
  if (raw.startsWith('WEEK') || raw === 'WEEKLY') return 'W';
  if (raw.startsWith('MONTH') || raw === 'MONTHLY') return 'M';
  if (raw.startsWith('HOUR') || raw === 'HOURLY') return 'H';
  if (raw.startsWith('CONT') || raw === 'N' || raw === 'ALWAYS' || raw === 'NEAR') return 'N';
  if (raw.startsWith('YEAR') || raw === 'YEARLY') return 'Y';
  if (raw.startsWith('QUART') || raw === 'QUARTERLY') return 'Q';
  return defaultValue;
}

/** SCR_TRACK_COUNTS char(1): Y/N (seed also used '1' historically — normalize to Y/N) */
function normalizeTrackCounts(value, { defaultValue = 'N' } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (value === 1 || value === true) return 'Y';
  if (value === 0 || value === false) return 'N';
  const raw = String(value).trim().toUpperCase();
  if (raw === 'Y' || raw === 'YES' || raw === 'TRUE' || raw === '1') return 'Y';
  if (raw === 'N' || raw === 'NO' || raw === 'FALSE' || raw === '0') return 'N';
  return defaultValue;
}

/** SCR_LAST_CHECK_STATUS char(1): S = success, F = fail */
function normalizeLastCheckStatus(value, { defaultValue = 'S' } = {}) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const raw = String(value).trim().toUpperCase();
  if (raw === 'S' || raw === 'SUCCESS' || raw === 'OK') return 'S';
  if (raw === 'F' || raw === 'FAIL' || raw === 'FAILED' || raw === 'ERROR') return 'F';
  return defaultValue;
}

function parseOptionalInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

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
        s.SCR_LAST_CHECK_STATUS AS last_check_status,
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
        s.SCR_DATE_UPDATED AS updated_at,
        s.SCR_STATUS AS status,
        s.SCR_DATE_LAST_CHECKED AS last_checked,
        s.SCR_LAST_CHECK_STATUS AS last_check_status,
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
    const {
      title,
      description,
      run_frequency,
      server_name,
      email_address,
      check_frequency,
      check_range,
      track_counts,
      last_check_status,
    } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });

    // SCRIPT NOT NULL: title, last_check_status, date_inserted, date_updated, status, track_counts
    // Use SQL literals for char NOT NULL columns so they can never bind as NULL.
    const trackCounts = normalizeTrackCounts(track_counts, { defaultValue: 'N' }) === 'Y' ? 'Y' : 'N';
    const lastCheckStatus = normalizeLastCheckStatus(last_check_status, { defaultValue: 'S' }) === 'F' ? 'F' : 'S';
    const runFrequency = normalizeRunFrequency(run_frequency);

    try {
      await syncSequence({ sequence: 'SCR_SEQ', table: 'SCRIPT', column: 'SCR_ID' });
    } catch (syncErr) {
      console.warn('SCR_SEQ sync before insert failed:', syncErr.message);
    }

    const result = await devDb.query(
      `INSERT INTO SCRIPT (
         SCR_TITLE,
         SCR_DESCRIPTION,
         SCR_RUN_FREQUENCY,
         SCR_SERVER_NAME,
         SCR_EMAIL_ADDRESS,
         SCR_CHECK_FREQUENCY,
         SCR_CHECK_RANGE,
         SCR_TRACK_COUNTS,
         SCR_LAST_CHECK_STATUS,
         SCR_STATUS,
         SCR_DATE_INSERTED,
         SCR_DATE_UPDATED
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, '${trackCounts}', '${lastCheckStatus}', 'A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING SCR_ID AS id, SCR_TITLE AS title`,
      [
        String(title).slice(0, 200),
        description || null,
        runFrequency,
        server_name ? String(server_name).slice(0, 100) : null,
        email_address ? String(email_address).slice(0, 200) : null,
        parseOptionalInt(check_frequency),
        parseOptionalInt(check_range),
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/scripts/:id', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      run_frequency,
      server_name,
      email_address,
      check_frequency,
      check_range,
      track_counts,
      status,
      last_check_status,
    } = req.body;

    const runFrequency =
      run_frequency === undefined || run_frequency === null || run_frequency === ''
        ? null
        : normalizeRunFrequency(run_frequency);
    if (run_frequency !== undefined && run_frequency !== null && run_frequency !== '' && !runFrequency) {
      return res.status(400).json({
        success: false,
        message: 'run_frequency must be D, W, M, H, N, Q, or Y',
      });
    }

    const trackCounts =
      track_counts === undefined ? null : normalizeTrackCounts(track_counts, { defaultValue: null });

    const lastCheckStatus =
      last_check_status === undefined || last_check_status === null || last_check_status === ''
        ? null
        : normalizeLastCheckStatus(last_check_status, { defaultValue: null });

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
        SCR_STATUS = COALESCE($9, SCR_STATUS),
        SCR_LAST_CHECK_STATUS = COALESCE($10, SCR_LAST_CHECK_STATUS),
        SCR_DATE_UPDATED = CURRENT_TIMESTAMP
       WHERE SCR_ID = $11
       RETURNING SCR_ID AS id, SCR_TITLE AS title`,
      [
        title ? String(title).slice(0, 200) : null,
        description !== undefined ? description || null : null,
        runFrequency,
        server_name !== undefined ? (server_name ? String(server_name).slice(0, 100) : null) : null,
        email_address !== undefined
          ? email_address
            ? String(email_address).slice(0, 200)
            : null
          : null,
        check_frequency !== undefined ? parseOptionalInt(check_frequency) : null,
        check_range !== undefined ? parseOptionalInt(check_range) : null,
        trackCounts,
        status || null,
        lastCheckStatus,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Script not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/scripts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `UPDATE SCRIPT SET SCR_STATUS = 'I', SCR_DATE_UPDATED = CURRENT_TIMESTAMP
       WHERE SCR_ID = $1 AND SCR_STATUS = 'A'
       RETURNING SCR_ID AS id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Script not found' });
    }
    res.json({ success: true, message: 'Script soft-deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
