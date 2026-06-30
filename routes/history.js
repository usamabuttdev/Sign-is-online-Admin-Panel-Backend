const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno) - 1) * limit;

    let where = '1=1';
    const params = [];
    if (search) {
      where += ' AND (h.HIS_MESSAGE LIKE @p1)';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM HISTORY h WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        h.HIS_ID AS id,
        COALESCE(acc.ACC_TITLE, loc.LOC_TITLE, usr.FullName, sig_acc.ACC_TITLE, pla.PLA_TITLE, dev.HardwareID, dev.DeviceID, '') AS object,
        h.HIS_MESSAGE AS message,
        h.HIS_DATE_INSERTED AS date
      FROM HISTORY h
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = h.HIS_ACC_ID
      LEFT JOIN LOCATION loc ON loc.LOC_ID = h.HIS_LOC_ID
      LEFT JOIN USERS usr ON usr.USR_ID = h.HIS_USR_ID
      LEFT JOIN SIGN sig ON sig.SIG_ID = h.HIS_SIG_ID
      LEFT JOIN ACCOUNT sig_acc ON sig_acc.ACC_ID = sig.SIG_ACC_ID
      LEFT JOIN PLATFORM pla ON pla.PLA_ID = h.HIS_PLA_ID
      LEFT JOIN IOT_Devices dev ON dev.DeviceID = h.HIS_DEVICEID
      WHERE ${where}
      ORDER BY h.HIS_DATE_INSERTED DESC
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
