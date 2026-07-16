const express = require('express');
const db = require('../services/dev-db');

const router = express.Router();

router.get('/list', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        PRO_ID AS id,
        PRO_TITLE AS name,
        0 AS price,
        '' AS description,
        PRO_DATE_INSERTED AS created_at
      FROM PRODUCT
      ORDER BY PRO_ID
    `);
    res.json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/details', async (req, res) => {
  try {
    const { productId } = req.query;
    if (!productId) return res.status(400).json({ message: 'productId required' });
    const result = await db.query(`
      SELECT
        PRO_ID AS id,
        PRO_TITLE AS name,
        0 AS price,
        '' AS description,
        PRO_DATE_INSERTED AS created_at
      FROM PRODUCT
      WHERE PRO_ID = @p1
    `, [productId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    let result;
    if (query) {
      result = await db.query(`
        SELECT
          PRO_ID AS id,
          PRO_TITLE AS name,
          0 AS price,
          '' AS description,
          PRO_DATE_INSERTED AS created_at
        FROM PRODUCT
        WHERE PRO_TITLE LIKE @p1
        ORDER BY PRO_ID
      `, [`%${query}%`]);
    } else {
      result = await db.query(`
        SELECT
          PRO_ID AS id,
          PRO_TITLE AS name,
          0 AS price,
          '' AS description,
          PRO_DATE_INSERTED AS created_at
        FROM PRODUCT
        ORDER BY PRO_ID
      `);
    }
    res.json({ results: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;