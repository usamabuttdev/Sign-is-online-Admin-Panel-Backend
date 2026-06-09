const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT s.*, p.name AS product_name, c.name AS customer_name FROM sales s LEFT JOIN products p ON p.id = s.product_id LEFT JOIN customers c ON c.id = s.customer_id ORDER BY s.sold_at DESC'
    );
    res.json({ sales: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT s.*, p.name AS product_name, c.name AS customer_name FROM sales s LEFT JOIN products p ON p.id = s.product_id LEFT JOIN customers c ON c.id = s.customer_id WHERE s.id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Sale not found' });
    res.json({ sale: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/product/:productId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT s.*, p.name AS product_name, c.name AS customer_name FROM sales s LEFT JOIN products p ON p.id = s.product_id LEFT JOIN customers c ON c.id = s.customer_id WHERE s.product_id = $1 ORDER BY s.sold_at DESC',
      [req.params.productId]
    );
    res.json({ sales: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
