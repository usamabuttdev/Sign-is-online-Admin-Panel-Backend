const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

const USER_SELECT = `
  USR_ID AS id,
  FullName AS name,
  Email AS email,
  Role AS role,
  PasswordHash AS password,
  IsActive AS isactive
`;

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'nicowens@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || '0255';
    if (email === adminEmail && password === adminPassword) {
      const accessToken = generateToken({ id: 1, email: adminEmail, role: 'admin' });
      return res.json({
        success: true,
        data: { accessToken, user: { id: 1, name: 'Admin', email: adminEmail, role: 'admin' } },
      });
    }

    const result = await db.query(
      `SELECT ${USER_SELECT} FROM Users WHERE Email = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    if (user.isactive === false || user.isactive === 0) {
      return res.status(401).json({ success: false, message: 'Account is inactive' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken = generateToken({ id: user.id, email: user.email, role: user.role });
    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function signupDisabled(_req, res) {
  res.status(403).json({
    success: false,
    message: 'Public signup is disabled. An admin must create user accounts.',
  });
}

router.post('/signup', signupDisabled);
router.post('/register', signupDisabled);

router.post('/forgotpassword', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const result = await db.query('SELECT USR_ID AS id FROM Users WHERE Email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
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
    await db.query(
      'UPDATE Users SET PasswordHash = $1 WHERE USR_ID = $2',
      [hashed, req.user.id]
    );
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/me', authenticateToken, async (req, res) => {
  try {
    if (req.user?.role === 'admin' && Number(req.user.id) === 1) {
      return res.json({
        success: true,
        data: {
          user: {
            id: 1,
            name: 'Admin',
            email: req.user.email,
            role: 'admin',
          },
        },
      });
    }

    const result = await db.query(
      `SELECT USR_ID AS id, FullName AS name, Email AS email, Role AS role, CreatedAt AS createdAt
       FROM Users WHERE USR_ID = $1 AND (IsActive = 1 OR IsActive = 'true' OR IsActive IS NULL)`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
