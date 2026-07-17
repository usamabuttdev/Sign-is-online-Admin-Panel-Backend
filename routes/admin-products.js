const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `SELECT
        p.PRO_ID AS id,
        p.PRO_TITLE AS title,
        p.PRO_SUBSCRIPTION_LENGTH AS subscription_length,
        CASE WHEN p.PRO_STATUS = 'A' THEN 'Yes' ELSE 'No' END AS status,
        p.PRO_DATE_INSERTED AS created_at
      FROM PRODUCT p
      WHERE p.PRO_ID = @p1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/products', authenticateToken, async (req, res) => {
  try {
    const { title, subscription_length } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required' });
    const result = await devDb.query(
      `INSERT INTO PRODUCT (PRO_TITLE, PRO_SUBSCRIPTION_LENGTH, PRO_STATUS, PRO_DATE_INSERTED)
       VALUES ($1, $2, 'A', CURRENT_TIMESTAMP) RETURNING PRO_ID AS id, PRO_TITLE AS title`,
      [title, subscription_length || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/products/:id', authenticateToken, async (req, res) => {
  try {
    const { title, subscription_length, status } = req.body;
    const prodStatus = status !== undefined ? (status === 'A' || status === true ? 'A' : 'I') : null;
    const result = await devDb.query(
      `UPDATE PRODUCT SET
        PRO_TITLE = COALESCE($1, PRO_TITLE),
        PRO_SUBSCRIPTION_LENGTH = COALESCE($2, PRO_SUBSCRIPTION_LENGTH),
        PRO_STATUS = COALESCE($3, PRO_STATUS)
       WHERE PRO_ID = $4
       RETURNING PRO_ID AS id, PRO_TITLE AS title`,
      [title || null, subscription_length || null, prodStatus, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/products/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `UPDATE PRODUCT SET PRO_STATUS = 'I' WHERE PRO_ID = $1 AND PRO_STATUS = 'A'
       RETURNING PRO_ID AS id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product soft-deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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
