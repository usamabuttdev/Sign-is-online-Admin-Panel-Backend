const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function getDefaultPassword() {
  const pw = process.env.DEFAULT_PASS_NEW_USER;
  if (!pw) {
    throw new Error('DEFAULT_PASS_NEW_USER env variable is required to create users');
  }
  return pw;
}

router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { name, email, phoneNumber, phone, role, isActive } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }
    const existing = await db.query('SELECT USR_ID FROM Users WHERE Email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const hashed = await bcrypt.hash(getDefaultPassword(), 10);
    const active =
      isActive === false || isActive === 0 || isActive === 'false' || isActive === '0' ? 0 : 1;

    // Users columns: FullName, Email, Phone, Role, PasswordHash, IsActive, CreatedAt,
    // USR_ADVISORY_COUNCIL (NOT NULL). No address/company/avatar/country columns.
    await db.query(
      `INSERT INTO Users (FullName, Email, Phone, Role, PasswordHash, IsActive, USR_ADVISORY_COUNCIL, CreatedAt)
       VALUES ($1, $2, $3, $4, $5, $6, 'N', CURRENT_TIMESTAMP)`,
      [name || '', email, phoneNumber || phone || null, role || 'user', hashed, active]
    );
    const result = await db.query(
      `SELECT USR_ID as id, FullName as name, Email as email, Phone as phone, Role as role,
              CreatedAt as createdat, IsActive as isactive
       FROM Users WHERE Email = $1`,
      [email]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, phoneNumber, role, password, isActive, status } = req.body;
    const fields = [];
    const params = [];
    let paramIdx = 1;

    if (name !== undefined) { fields.push(`FullName = $${paramIdx++}`); params.push(name); }
    if (email !== undefined) { fields.push(`Email = $${paramIdx++}`); params.push(email); }
    const phoneVal = phone !== undefined ? phone : phoneNumber;
    if (phoneVal !== undefined) { fields.push(`Phone = $${paramIdx++}`); params.push(phoneVal); }
    if (role !== undefined) { fields.push(`Role = $${paramIdx++}`); params.push(role); }
    if (password !== undefined) {
      const hashed = await bcrypt.hash(password, 10);
      fields.push(`PasswordHash = $${paramIdx++}`);
      params.push(hashed);
    }

    let activeVal;
    if (isActive !== undefined) {
      activeVal = isActive === false || isActive === 0 || isActive === 'false' || isActive === '0' ? 0 : 1;
    } else if (status !== undefined) {
      activeVal = status === 'banned' || status === 'I' || status === 'inactive' ? 0 : 1;
    }
    if (activeVal !== undefined) {
      fields.push(`IsActive = $${paramIdx++}`);
      params.push(activeVal);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    params.push(req.params.id);

    await db.query(
      `UPDATE Users SET ${fields.join(', ')} WHERE USR_ID = $${paramIdx}`,
      params
    );
    const result = await db.query(
      `SELECT USR_ID as id, FullName as name, Email as email, Phone as phone, Role as role,
              CreatedAt as createdat, IsActive as isactive
       FROM Users WHERE USR_ID = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user?.id != null && String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }
    const check = await db.query('SELECT USR_ID as id FROM Users WHERE USR_ID = $1', [req.params.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    await db.query(
      `UPDATE Users SET IsActive = 0 WHERE USR_ID = $1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'User soft-deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/all-users', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', isActive } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const params = [];
    let where = 'WHERE 1=1';
    let idx = 1;

    // Default: only active users (soft-delete hides IsActive = 0)
    if (isActive === undefined || isActive === '') {
      where += ` AND (IsActive = 1 OR IsActive = 'true' OR IsActive IS NULL)`;
    } else if (isActive === 'true' || isActive === '1') {
      where += ` AND (IsActive = 1 OR IsActive = 'true')`;
    } else if (isActive === 'false' || isActive === '0') {
      where += ` AND (IsActive = 0 OR IsActive = 'false')`;
    }

    if (keyword) {
      where += ` AND (FullName LIKE $${idx} OR Email LIKE $${idx})`;
      params.push(`%${keyword}%`);
      idx += 1;
    }

    const countResult = await db.query(`SELECT COUNT(*) as cnt FROM Users ${where}`, params);
    const total = countResult.rows.length > 0 ? parseInt(countResult.rows[0].cnt, 10) : 0;

    const dataParams = [...params, parseInt(limit, 10), offset];
    const dataSQL = `
      SELECT USR_ID as id, FullName as name, Email as email, Phone as phone, Role as role,
             CreatedAt as createdat, IsActive as isactive
      FROM Users ${where}
      ORDER BY CreatedAt DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const result = await db.query(dataSQL, dataParams);
    res.json({
      success: true,
      data: result.rows,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/listings-by-user/:id', authenticateToken, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page, 10) - 1) * limit;
    const result = await db.query(
      'SELECT * FROM bookings WHERE userid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
      [req.params.id, limit, offset]
    );
    const countResult = await db.query('SELECT COUNT(*) FROM bookings WHERE userid = $1', [req.params.id]);
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/users/:id/account-state', authenticateToken, async (req, res) => {
  try {
    const { isActive } = req.body;
    await db.query(
      'UPDATE Users SET IsActive = $1 WHERE USR_ID = $2',
      [isActive, req.params.id]
    );
    res.json({ success: true, message: 'User status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user-bookings/:id', authenticateToken, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page, 10) - 1) * limit;
    const result = await db.query(
      'SELECT * FROM bookings WHERE userid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
      [req.params.id, limit, offset]
    );
    const countResult = await db.query('SELECT COUNT(*) FROM bookings WHERE userid = $1', [req.params.id]);
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user-rentals/:id', authenticateToken, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page, 10) - 1) * limit;
    const result = await db.query(
      'SELECT * FROM bookings WHERE userid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
      [req.params.id, limit, offset]
    );
    const countResult = await db.query('SELECT COUNT(*) FROM bookings WHERE userid = $1', [req.params.id]);
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user-earnings/:id', authenticateToken, async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (parseInt(page, 10) - 1) * limit;
    const result = await db.query(
      'SELECT * FROM transactions WHERE customerid = $1 ORDER BY id DESC LIMIT $2 OFFSET $3',
      [req.params.id, limit, offset]
    );
    const countResult = await db.query(
      'SELECT COUNT(*) FROM transactions WHERE customerid = $1',
      [req.params.id]
    );
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/documents-verification', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, keyword = '', status } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (keyword) {
      where += ` AND name LIKE $${idx++}`;
      params.push(`%${keyword}%`);
    }
    if (status) {
      where += ` AND status = $${idx++}`;
      params.push(status);
    }
    const countResult = await db.query(`SELECT COUNT(*) FROM customers ${where}`, params);
    const result = await db.query(
      `SELECT * FROM customers ${where} ORDER BY id DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit, 10), offset]
    );
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/documents/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      'UPDATE customers SET status = $1, updatedat = CURRENT_TIMESTAMP WHERE id = $2',
      [status, req.params.id]
    );
    res.json({ success: true, message: 'Document status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT USR_ID as id, FullName as name, Email as email, Phone as phone, Role as role,
              IsActive as isactive, CreatedAt as createdat
       FROM Users WHERE USR_ID = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user/profile/:id', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT USR_ID as id, FullName as name, Email as email, Phone as phone, Role as role, CreatedAt as created_at
       FROM Users WHERE USR_ID = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user/:id/locations', authenticateToken, async (req, res) => {
  try {
    const tableNames = ['USERS_LOCATION_MAP', 'USER_LOCATION_MAP', 'USERS_LOCATIONS_MAP', 'USER_LOCATIONS_MAP'];
    let result = null;
    let lastError = null;
    for (const tbl of tableNames) {
      try {
        result = await db.query(
          `SELECT l.LOC_ID as id, l.LOC_TITLE as title, ulm.ULM_DATE_INSERTED as added
           FROM ${tbl} ulm
           INNER JOIN LOCATION l ON l.LOC_ID = ulm.ULM_LOC_ID
           WHERE ulm.ULM_USR_ID = @p1
           ORDER BY ulm.ULM_DATE_INSERTED DESC`,
          [req.params.id]
        );
        if (result.rows.length > 0 || result.rowCount > 0) break;
      } catch (e) {
        lastError = e;
      }
    }
    if (!result) {
      throw lastError || new Error('No mapping table found');
    }
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
