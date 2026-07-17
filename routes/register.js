/**
 * Legacy register route — public signup is disabled.
 * Admins create users via POST /api/admin/users.
 */
const express = require('express');

const router = express.Router();

router.post('/', (_req, res) => {
  res.status(403).json({
    success: false,
    message: 'Public signup is disabled. An admin must create user accounts.',
  });
});

module.exports = router;
