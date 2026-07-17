const express = require('express');
const devDb = require('../services/dev-db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const { pageno = 1, search = '' } = req.query;
    const limit = 10;
    const offset = (parseInt(pageno, 10) - 1) * limit;

    let where = "d.status <> 'deleted'";
    const params = [];
    if (search) {
      where += ' AND (d.device_id LIKE @p1 OR d.hardware_type LIKE @p1 OR d.status LIKE @p1)';
      params.push(`%${search}%`);
    }

    const countResult = await devDb.query(
      `SELECT COUNT(*) AS cnt FROM DEVICES d WHERE ${where}`,
      params
    );

    const listQuery = `
      SELECT
        d.id,
        d.device_id,
        ISNULL(l.LOC_TITLE, '') AS location,
        d.hardware_type,
        d.firmware_version,
        d.status,
        d.last_heartbeat,
        d.created_at
      FROM DEVICES d
      LEFT JOIN LOCATION l ON l.LOC_ID = d.location_id
      WHERE ${where}
      ORDER BY d.created_at DESC
      OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
    `;

    const result = await devDb.query(listQuery, params);
    res.json({
      success: true,
      data: result.rows,
      total: parseInt(countResult.rows[0].cnt, 10),
      page: parseInt(pageno, 10),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/devices', authenticateToken, async (req, res) => {
  try {
    const { device_id, location_id, hardware_type, firmware_version, status } = req.body;
    if (!device_id) return res.status(400).json({ success: false, message: 'Device ID required' });
    const result = await devDb.query(
      `INSERT INTO DEVICES (device_id, location_id, hardware_type, firmware_version, status, created_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP) RETURNING id, device_id`,
      [device_id, location_id || null, hardware_type || null, firmware_version || null, status || 'active']
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/devices/:id', authenticateToken, async (req, res) => {
  try {
    const { location_id, hardware_type, firmware_version, status, last_heartbeat } = req.body;
    const result = await devDb.query(
      `UPDATE DEVICES SET
        location_id = COALESCE($1, location_id),
        hardware_type = COALESCE($2, hardware_type),
        firmware_version = COALESCE($3, firmware_version),
        status = COALESCE($4, status),
        last_heartbeat = COALESCE($5, last_heartbeat)
       WHERE id = $6 AND status <> 'deleted'
       RETURNING id, device_id`,
      [location_id || null, hardware_type || null, firmware_version || null, status || null, last_heartbeat || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Device not found' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/devices/:id', authenticateToken, async (req, res) => {
  try {
    const result = await devDb.query(
      `UPDATE DEVICES SET status = 'deleted'
       WHERE id = $1 AND status <> 'deleted'
       RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Device not found' });
    }
    res.json({ success: true, message: 'Device soft-deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
