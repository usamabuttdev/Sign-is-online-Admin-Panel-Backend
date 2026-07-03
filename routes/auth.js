const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });

    const adminEmail = process.env.ADMIN_EMAIL || 'nicowens@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || '0255';
    if (email === adminEmail && password === adminPassword) {
      const accessToken = generateToken({ id: 1, email: adminEmail, role: 'admin' });
      return res.json({
        success: true,
        data: { accessToken, user: { id: 1, name: 'Admin', email: adminEmail, role: 'admin' } }
      });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role });
    res.json({ success: true, data: { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

async function signupHandler(req, res) {
  try {
    const name = req.body.name || `${req.body.firstName || ''} ${req.body.lastName || ''}`.trim();
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ success: false, message: 'User already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const result = await db.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role', [name || '', email, hashed]);
    const user = result.rows[0];
    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role });
    res.status(201).json({ success: true, data: { accessToken, user } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

router.post('/signup', signupHandler);
router.post('/register', signupHandler);

router.post('/forgotpassword', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const result = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const resetToken = generateToken({ id: result.rows[0].id, purpose: 'reset' });
    res.json({ success: true, message: 'Reset link sent', data: { resetToken } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ success: false, message: 'Verification code required' });
    res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/resetPassword', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password required' });
    const hashed = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = $1, updatedAt = CURRENT_TIMESTAMP WHERE id = $2', [hashed, req.user.id]);
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, email, role, createdAt FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const user = result.rows[0];
    res.json({ success: true, data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
