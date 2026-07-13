const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/accounts', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = "a.ACC_STATUS = 'A'";
    const params = [];
    if (search) {
      where += ' AND a.ACC_TITLE LIKE @p1';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM ACCOUNT a WHERE ${where}`,
      params
    );

    let listWhere = "a.ACC_STATUS = 'A'";
    const listParams = [];
    if (search) {
      listWhere += ' AND (a.ACC_TITLE LIKE @p1 OR loc.location_names LIKE @p1)';
      listParams.push(`%${search}%`);
    }

    const listQuery = `
      SELECT
        a.ACC_ID AS id,
        a.ACC_TITLE AS title,
        a.ACC_DATE_INSERTED AS created_at,
        ISNULL(loc.location_names, '') AS locations,
        ISNULL(loc.location_count, 0) AS location_count,
        ISNULL(sig.sign_count, 0) AS signs,
        ISNULL(chg.total_charged, 0) AS total_charged,
        ISNULL(usr.FullName, '') AS created_by_name
      FROM ACCOUNT a
      LEFT JOIN Users usr ON usr.USR_ID = a.ACC_USR_ID_CREATED_BY
      LEFT JOIN (
        SELECT
          LOC_ACC_ID,
          COUNT(*) AS location_count,
          STRING_AGG(CAST(LOC_CITY AS NVARCHAR(MAX)), ', ') AS location_names
        FROM LOCATION
        WHERE LOC_STATUS = 'A'
        GROUP BY LOC_ACC_ID
      ) loc ON loc.LOC_ACC_ID = a.ACC_ID
      LEFT JOIN (
        SELECT SIG_ACC_ID, COUNT(*) AS sign_count
        FROM SIGN
        WHERE SIG_STATUS = 'A'
        GROUP BY SIG_ACC_ID
      ) sig ON sig.SIG_ACC_ID = a.ACC_ID
      LEFT JOIN (
        SELECT CHA_ACC_ID, ISNULL(SUM(CHA_AMOUNT), 0) AS total_charged
        FROM CHARGE
        GROUP BY CHA_ACC_ID
      ) chg ON chg.CHA_ACC_ID = a.ACC_ID
      WHERE ${listWhere}
      ORDER BY a.ACC_DATE_INSERTED DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await devDb.query(listQuery, listParams);
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

router.get('/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        a.ACC_ID AS id,
        a.ACC_TITLE AS title,
        CASE WHEN a.ACC_OBSERVES_DAYLIGHT = 'Y' THEN 1 ELSE 0 END AS observes_daylight,
        a.ACC_DATE_INSERTED AS created_at,
        a.ACC_STATUS AS status,
        ISNULL(tz.TZ_TITLE, '') AS tz_title,
        ISNULL(tz.TZ_OFFSET, 0) AS tz_offset,
        ISNULL(loc.location_names, '') AS locations,
        ISNULL(sig.sign_count, 0) AS signs,
        ISNULL(chg.total_charged, 0) AS total_charged,
        ISNULL(usr.FullName, '') AS created_by_name
      FROM ACCOUNT a
      LEFT JOIN Users usr ON usr.USR_ID = a.ACC_USR_ID_CREATED_BY
      LEFT JOIN TIME_ZONE tz ON tz.TZ_ID = a.ACC_TZ_ID
      LEFT JOIN (
        SELECT
          LOC_ACC_ID,
          STRING_AGG(CAST(LOC_CITY AS NVARCHAR(MAX)), ', ') AS location_names
        FROM LOCATION WHERE LOC_STATUS = 'A'
        GROUP BY LOC_ACC_ID
      ) loc ON loc.LOC_ACC_ID = a.ACC_ID
      LEFT JOIN (
        SELECT SIG_ACC_ID, COUNT(*) AS sign_count
        FROM SIGN WHERE SIG_STATUS = 'A'
        GROUP BY SIG_ACC_ID
      ) sig ON sig.SIG_ACC_ID = a.ACC_ID
      LEFT JOIN (
        SELECT CHA_ACC_ID, ISNULL(SUM(CHA_AMOUNT), 0) AS total_charged
        FROM CHARGE
        GROUP BY CHA_ACC_ID
      ) chg ON chg.CHA_ACC_ID = a.ACC_ID
      WHERE a.ACC_ID = @p1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/accounts', authenticateToken, async (req, res) => {
  try {
    const { title, timezone_id, observes_daylight } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const result = await devDb.query(
      `INSERT INTO ACCOUNT (ACC_TITLE, ACC_TZ_ID, ACC_OBSERVES_DAYLIGHT, ACC_STATUS, ACC_DATE_INSERTED)
       VALUES ($1, $2, $3, 'A', CURRENT_TIMESTAMP) RETURNING ACC_ID AS id, ACC_TITLE AS title`,
      [title, timezone_id || null, observes_daylight ? 'Y' : 'N']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/accounts/:id', authenticateToken, async (req, res) => {
  try {
    const { title, timezone_id, observes_daylight, status } = req.body;
    const result = await devDb.query(
      `UPDATE ACCOUNT SET
        ACC_TITLE = COALESCE($1, ACC_TITLE),
        ACC_TZ_ID = COALESCE($2, ACC_TZ_ID),
        ACC_OBSERVES_DAYLIGHT = COALESCE($3, ACC_OBSERVES_DAYLIGHT),
        ACC_STATUS = COALESCE($4, ACC_STATUS)
       WHERE ACC_ID = $5
       RETURNING ACC_ID AS id, ACC_TITLE AS title`,
      [title || null, timezone_id || null, observes_daylight !== undefined ? (observes_daylight ? 'Y' : 'N') : null, status || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Account not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
