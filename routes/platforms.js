const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const YES_VALUES = new Set(['y', 'yes', 'true', '1']);
const NO_VALUES = new Set(['n', 'no', 'false', '0']);

/** PLA_AVAILABLE is char(1): Y/N */
function normalizeAvailable(value, { defaultValue = null } = {}) {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') return value ? 'Y' : 'N';
  if (value === 1) return 'Y';
  if (value === 0) return 'N';
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    if (YES_VALUES.has(cleaned)) return 'Y';
    if (NO_VALUES.has(cleaned)) return 'N';
  }
  return defaultValue;
}

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
        p.PLA_AVAILABLE AS available_flag,
        CASE WHEN p.PLA_AVAILABLE = 'Y' THEN 'Yes' ELSE 'No' END AS available,
        p.PLA_STATUS AS status,
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
        p.PLA_AVAILABLE AS available_flag,
        CASE WHEN p.PLA_AVAILABLE = 'Y' THEN 'Yes' ELSE 'No' END AS available,
        p.PLA_STATUS AS status,
        ISNULL(lpm.connected_count, 0) AS connected_count,
        p.PLA_DATE_INSERTED AS created_at,
        p.PLA_DATE_UPDATED AS updated_at
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

router.post('/platforms', authenticateToken, async (req, res) => {
  try {
    const { title, available } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });

    // PLATFORM NOT NULL: PLA_TITLE, PLA_AVAILABLE, PLA_DATE_INSERTED, PLA_DATE_UPDATED, PLA_STATUS
const availableFlag = normalizeAvailable(available, { defaultValue: 'Y' });

    // Seed scripts insert explicit PLA_IDs and can leave PLA_SEQ behind — resync before insert.
    try {
      const { syncSequence } = require('../services/sequences-schema');
      await syncSequence({ sequence: 'PLA_SEQ', table: 'PLATFORM', column: 'PLA_ID' });
    } catch (syncErr) {
      console.warn('PLA_SEQ sync before insert failed:', syncErr.message);
    }

    const result = await devDb.query(
      `INSERT INTO PLATFORM (
         PLA_TITLE,
         PLA_AVAILABLE,
         PLA_STATUS,
         PLA_DATE_INSERTED,
         PLA_DATE_UPDATED
       )
       VALUES ($1, $2, 'A', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING PLA_ID AS id, PLA_TITLE AS title`,
      [String(title).slice(0, 40), availableFlag]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/platforms/:id', authenticateToken, async (req, res) => {
  try {
    const { title, status, available } = req.body;
    if (title !== undefined && !title) {
      return res.status(400).json({ success: false, message: 'Title required' });
    }

    const platStatus =
      status === undefined || status === null || status === ''
        ? null
        : status === 'A' || status === true || status === 'Y' || status === 'Yes'
          ? 'A'
          : 'I';

    const availableFlag =
      available === undefined || available === null || available === ''
        ? null
        : normalizeAvailable(available);
    if (available !== undefined && available !== null && available !== '' && !availableFlag) {
      return res.status(400).json({
        success: false,
        message: 'available must be Y or N (PLA_AVAILABLE)',
      });
    }

    const result = await devDb.query(
      `UPDATE PLATFORM SET
        PLA_TITLE = COALESCE($1, PLA_TITLE),
        PLA_AVAILABLE = COALESCE($2, PLA_AVAILABLE),
        PLA_STATUS = COALESCE($3, PLA_STATUS),
        PLA_DATE_UPDATED = CURRENT_TIMESTAMP
       WHERE PLA_ID = $4
       RETURNING PLA_ID AS id, PLA_TITLE AS title`,
      [
        title ? String(title).slice(0, 40) : null,
        availableFlag,
        platStatus,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Platform not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/platforms/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `UPDATE PLATFORM SET PLA_STATUS = 'I', PLA_DATE_UPDATED = CURRENT_TIMESTAMP
       WHERE PLA_ID = $1 AND PLA_STATUS = 'A'
       RETURNING PLA_ID AS id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Platform not found' });
    }
    res.json({ success: true, message: 'Platform soft-deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
