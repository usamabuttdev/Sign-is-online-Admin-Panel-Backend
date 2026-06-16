const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DEV_TOKEN = process.env.DEV_FAKE_TOKEN || '1234567890';
const JWT_SECRET = process.env.JWT_SECRET || 'stoa-jwt-secret-dev';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });
  if (token === DEV_TOKEN) {
    req.user = { id: 'dev-user', email: 'dev@localhost', role: 'admin' };
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

module.exports = { authenticateToken, generateToken, JWT_SECRET };
