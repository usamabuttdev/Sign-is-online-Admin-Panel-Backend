const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/views', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await db.query(
      'SELECT pv.*, p.name AS product_name FROM product_views pv LEFT JOIN products p ON p.id = pv.product_id ORDER BY pv.viewed_at DESC LIMIT $1',
      [limit]
    );
    res.json({ views: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:productId/views', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM product_views WHERE product_id = $1 ORDER BY viewed_at DESC',
      [req.params.productId]
    );
    res.json({ views: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
