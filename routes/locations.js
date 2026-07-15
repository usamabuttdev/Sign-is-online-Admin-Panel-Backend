const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const YES_VALUES = new Set(['y', 'yes', 'true', '1']);
const NO_VALUES = new Set(['n', 'no', 'false', '0']);

function normalizeFlag(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'boolean') {
    return value ? 'Y' : 'N';
  }

  if (value === 1) {
    return 'Y';
  }

  if (value === 0) {
    return 'N';
  }

  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    if (YES_VALUES.has(cleaned)) return 'Y';
    if (NO_VALUES.has(cleaned)) return 'N';
  }

  return null;
}

function flagOrDefault(value, fallback = 'N') {
  const normalized = normalizeFlag(value);
  return normalized !== null ? normalized : fallback;
}

const router = express.Router();

router.get('/locations', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = "l.LOC_STATUS = 'A'";
    const params = [];
    if (search) {
      where += ' AND (l.LOC_TITLE LIKE @p1 OR acc.ACC_TITLE LIKE @p1 OR l.LOC_CITY LIKE @p1)';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM LOCATION l LEFT JOIN ACCOUNT acc ON acc.ACC_ID = l.LOC_ACC_ID WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        l.LOC_ID AS id,
        l.LOC_ACC_ID AS account_id,
        l.LOC_TITLE AS title,
        ISNULL(acc.ACC_TITLE, '') AS account,
        CASE WHEN l.LOC_AUTHENTICATED = 'Y' THEN 'Yes' ELSE 'No' END AS authenticated,
        CASE WHEN sig.sign_count > 0 THEN 'Yes' ELSE 'No' END AS sign_exists,
        ISNULL(lpm.platform_count, 0) AS platforms_count,
        ISNULL(pr.PRO_TITLE, '') AS product,
        CASE WHEN l.LOC_HAS_ACTIVE_SUBSCRIPTION = 'Y' THEN 1 ELSE 0 END AS subscription,
        ISNULL(l.LOC_CITY, '') AS city,
        ISNULL(l.LOC_SP_ABBREV, '') AS state,
        l.LOC_DATE_INSERTED AS created_at
      FROM LOCATION l
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = l.LOC_ACC_ID
      LEFT JOIN (
        SELECT SIG_ACC_ID, COUNT(*) AS sign_count
        FROM SIGN
        WHERE SIG_STATUS = 'A'
        GROUP BY SIG_ACC_ID
      ) sig ON sig.SIG_ACC_ID = l.LOC_ACC_ID
      LEFT JOIN (
        SELECT LPM_LOC_ID, COUNT(*) AS platform_count
        FROM LOCATION_PLATFORM_MAP
        WHERE LPM_STATUS = 'A'
        GROUP BY LPM_LOC_ID
      ) lpm ON lpm.LPM_LOC_ID = l.LOC_ID
      LEFT JOIN PRODUCT pr ON pr.PRO_ID = l.LOC_PRO_ID
      WHERE ${where}
      ORDER BY l.LOC_DATE_INSERTED DESC
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

router.get('/locations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        l.LOC_ID AS id,
        l.LOC_ACC_ID AS account_id,
        l.LOC_TITLE AS title,
        ISNULL(acc.ACC_TITLE, '') AS account,
        CASE WHEN l.LOC_AUTHENTICATED = 'Y' THEN 'Yes' ELSE 'No' END AS authenticated,
        CASE WHEN sig.sign_count > 0 THEN 'Yes' ELSE 'No' END AS sign_exists,
        ISNULL(lpm.platform_count, 0) AS platforms_count,
        ISNULL(pr.PRO_TITLE, '') AS product,
        CASE WHEN l.LOC_HAS_ACTIVE_SUBSCRIPTION = 'Y' THEN 1 ELSE 0 END AS subscription,
        ISNULL(l.LOC_CITY, '') AS city,
        ISNULL(l.LOC_SP_ABBREV, '') AS state,
        l.LOC_DATE_INSERTED AS created_at
      FROM LOCATION l
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = l.LOC_ACC_ID
      LEFT JOIN (
        SELECT SIG_ACC_ID, COUNT(*) AS sign_count
        FROM SIGN WHERE SIG_STATUS = 'A'
        GROUP BY SIG_ACC_ID
      ) sig ON sig.SIG_ACC_ID = l.LOC_ACC_ID
      LEFT JOIN (
        SELECT LPM_LOC_ID, COUNT(*) AS platform_count
        FROM LOCATION_PLATFORM_MAP
        WHERE LPM_STATUS = 'A'
        GROUP BY LPM_LOC_ID
      ) lpm ON lpm.LPM_LOC_ID = l.LOC_ID
      LEFT JOIN PRODUCT pr ON pr.PRO_ID = l.LOC_PRO_ID
      WHERE l.LOC_ID = @p1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Location not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/locations', authenticateToken, async (req, res) => {
  try {
  const { account_id, title, city, state, product_id, authenticated, has_active_subscription } = req.body;
  if (!account_id || !title) return res.status(400).json({ success: false, message: 'Account ID and title required' });
  const result = await devDb.query(
    `INSERT INTO LOCATION (LOC_ACC_ID, LOC_TITLE, LOC_CITY, LOC_SP_ABBREV, LOC_PRO_ID, LOC_AUTHENTICATED, LOC_HAS_ACTIVE_SUBSCRIPTION, LOC_STATUS, LOC_DATE_INSERTED)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'A', CURRENT_TIMESTAMP) RETURNING LOC_ID AS id, LOC_TITLE AS title`,
    [
      account_id,
      title,
      city || null,
      state || null,
      product_id || null,
      flagOrDefault(authenticated),
      flagOrDefault(has_active_subscription),
    ]
  );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/locations/:id', authenticateToken, async (req, res) => {
  try {
  const { title, city, state, product_id, authenticated, has_active_subscription, status } = req.body;
  const authenticatedFlag = normalizeFlag(authenticated);
  const subscriptionFlag = normalizeFlag(has_active_subscription);
  const result = await devDb.query(
    `UPDATE LOCATION SET
      LOC_TITLE = COALESCE($1, LOC_TITLE),
      LOC_CITY = COALESCE($2, LOC_CITY),
      LOC_SP_ABBREV = COALESCE($3, LOC_SP_ABBREV),
      LOC_PRO_ID = COALESCE($4, LOC_PRO_ID),
      LOC_AUTHENTICATED = COALESCE($5, LOC_AUTHENTICATED),
      LOC_HAS_ACTIVE_SUBSCRIPTION = COALESCE($6, LOC_HAS_ACTIVE_SUBSCRIPTION),
      LOC_STATUS = COALESCE($7, LOC_STATUS)
     WHERE LOC_ID = $8
     RETURNING LOC_ID AS id, LOC_TITLE AS title`,
    [title || null, city || null, state || null, product_id || null,
     authenticatedFlag,
     subscriptionFlag,
     status || null, req.params.id]
  );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Location not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
