const express = require('express');
const db = require('../services/dev-db');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT s.*, p.name AS product_name, c.name AS customer_name FROM sales s LEFT JOIN products p ON p.id = s.product_id LEFT JOIN customers c ON c.id = s.customer_id ORDER BY s.sold_at DESC'
    );
    res.json({ sales: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
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

router.get('/product/:productId', authenticateToken, async (req, res) => {
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

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity, unit_price, customer_id } = req.body;
    if (!product_id || unit_price === undefined) return res.status(400).json({ success: false, message: 'Product ID and unit price required' });
    const qty = quantity || 1;
    const total = parseFloat(unit_price) * parseInt(qty);
    const result = await db.query(
      'INSERT INTO sales (product_id, quantity, unit_price, total, customer_id, sold_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING *',
      [product_id, qty, unit_price, total, customer_id || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity, unit_price, customer_id } = req.body;
    const result = await db.query(
      `UPDATE sales SET
        product_id = COALESCE($1, product_id),
        quantity = COALESCE($2, quantity),
        unit_price = COALESCE($3, unit_price),
        total = COALESCE($4, total),
        customer_id = COALESCE($5, customer_id)
       WHERE id = $6 RETURNING *`,
      [product_id || null, quantity || null, unit_price || null, unit_price && quantity ? parseFloat(unit_price) * parseInt(quantity) : null, customer_id || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Sale not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
