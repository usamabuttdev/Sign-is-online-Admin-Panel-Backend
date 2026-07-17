const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/charges', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno, 10) - 1) * limit;

    let where = "ISNULL(c.CHA_STATUS, 'A') = 'A'";
    const params = [];
    if (search) {
      where += ' AND (acc.ACC_TITLE LIKE @p1 OR c.CHA_METHOD LIKE @p1)';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM CHARGE c LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        c.CHA_ID AS id,
        c.CHA_ACC_ID AS account_id,
        ISNULL(acc.ACC_TITLE, '') AS account,
        c.CHA_AMOUNT AS amount,
        ISNULL(c.CHA_METHOD, '') AS method,
        c.CHA_DATE_INSERTED AS created_at,
        CASE WHEN c.CHA_AMOUNT > 0 THEN 'Successful' ELSE 'Attempted' END AS status
      FROM CHARGE c
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID
      WHERE ${where}
      ORDER BY c.CHA_DATE_INSERTED DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await devDb.query(listQuery, params);
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].cnt, 10),
      page: parseInt(pageno, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/charges/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        c.CHA_ID AS id,
        c.CHA_ACC_ID AS account_id,
        ISNULL(acc.ACC_TITLE, '') AS account,
        c.CHA_AMOUNT AS amount,
        ISNULL(c.CHA_METHOD, '') AS method,
        c.CHA_DATE_INSERTED AS created_at,
        CASE WHEN c.CHA_AMOUNT > 0 THEN 'Successful' ELSE 'Attempted' END AS status
      FROM CHARGE c
      LEFT JOIN ACCOUNT acc ON acc.ACC_ID = c.CHA_ACC_ID
      WHERE c.CHA_ID = @p1 AND ISNULL(c.CHA_STATUS, 'A') = 'A'`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/charges', authenticateToken, async (req, res) => {
  try {
    const { account_id, amount, method } = req.body;
    if (!account_id || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Account ID and amount required' });
    }
    const result = await devDb.query(
      `INSERT INTO CHARGE (CHA_ACC_ID, CHA_AMOUNT, CHA_METHOD, CHA_STATUS, CHA_DATE_INSERTED)
       VALUES ($1, $2, $3, 'A', CURRENT_TIMESTAMP) RETURNING CHA_ID AS id, CHA_AMOUNT AS amount`,
      [account_id, amount, method || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/charges/:id', authenticateToken, async (req, res) => {
  try {
    const { amount, method } = req.body;
    if (amount === undefined) return res.status(400).json({ success: false, message: 'Amount required' });
    const result = await devDb.query(
      `UPDATE CHARGE SET CHA_AMOUNT = COALESCE($1, CHA_AMOUNT), CHA_METHOD = COALESCE($2, CHA_METHOD)
       WHERE CHA_ID = $3 AND ISNULL(CHA_STATUS, 'A') = 'A'
       RETURNING CHA_ID AS id, CHA_AMOUNT AS amount`,
      [amount, method || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Charge not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/charges/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `UPDATE CHARGE SET CHA_STATUS = 'I'
       WHERE CHA_ID = $1 AND ISNULL(CHA_STATUS, 'A') = 'A'
       RETURNING CHA_ID AS id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }
    res.json({ success: true, message: 'Charge soft-deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
