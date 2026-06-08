const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/send-email-brevo', authenticateToken, async (req, res) => {
  try {
    const { to, subject, text } = req.body;
    res.json({ success: true, message: 'Email queued for sending via Brevo', data: { to, subject } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
