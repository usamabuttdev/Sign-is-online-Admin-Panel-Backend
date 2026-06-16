const express = require('express');
const db = require('../services/dev-db');

const router = express.Router();

router.get('/metrics', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT pm.*, p.name AS product_name FROM product_metrics pm LEFT JOIN products p ON p.id = pm.product_id ORDER BY pm.revenue DESC'
    );
    res.json({ metrics: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:productId/metrics', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT pm.*, p.name AS product_name FROM product_metrics pm LEFT JOIN products p ON p.id = pm.product_id WHERE pm.product_id = $1',
      [req.params.productId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Metrics not found for product' });
    res.json({ metrics: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
