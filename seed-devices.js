const devDb = require('./services/dev-db');

const devices = [
  { deviceId: 'DEV-001', locationId: 1, hardwareType: 'Tablet', firmwareVersion: 'v2.1.0', status: 'active', lastHeartbeat: '2026-06-30T12:00:00' },
  { deviceId: 'DEV-002', locationId: 1, hardwareType: 'Kiosk', firmwareVersion: 'v3.0.1', status: 'active', lastHeartbeat: '2026-06-30T11:45:00' },
  { deviceId: 'DEV-003', locationId: 2, hardwareType: 'Tablet', firmwareVersion: 'v2.1.0', status: 'active', lastHeartbeat: '2026-06-30T10:30:00' },
  { deviceId: 'DEV-004', locationId: 3, hardwareType: 'Smart Display', firmwareVersion: 'v1.2.3', status: 'inactive', lastHeartbeat: '2026-06-28T08:00:00' },
  { deviceId: 'DEV-005', locationId: null, hardwareType: 'Kiosk', firmwareVersion: 'v3.0.1', status: 'maintenance', lastHeartbeat: '2026-06-29T16:00:00' },
  { deviceId: 'DEV-006', locationId: 4, hardwareType: 'Tablet', firmwareVersion: 'v2.0.9', status: 'active', lastHeartbeat: '2026-06-30T13:00:00' },
  { deviceId: 'DEV-007', locationId: 5, hardwareType: 'Smart Display', firmwareVersion: 'v1.2.3', status: 'active', lastHeartbeat: '2026-06-30T09:15:00' },
  { deviceId: 'DEV-008', locationId: 2, hardwareType: 'Kiosk', firmwareVersion: 'v2.3.0', status: 'active', lastHeartbeat: '2026-06-30T12:30:00' },
  { deviceId: 'SD-101', locationId: null, hardwareType: 'Digital Sign', firmwareVersion: 'v4.0.0', status: 'active', lastHeartbeat: '2026-06-30T13:15:00' },
  { deviceId: 'SD-102', locationId: 6, hardwareType: 'Digital Sign', firmwareVersion: 'v4.0.0', status: 'inactive', lastHeartbeat: '2026-06-25T14:00:00' },
  { deviceId: 'DEV-009', locationId: 3, hardwareType: 'Tablet', firmwareVersion: 'v2.1.0', status: 'active', lastHeartbeat: '2026-06-30T11:00:00' },
  { deviceId: 'DEV-010', locationId: 1, hardwareType: 'Smart Display', firmwareVersion: 'v1.3.0', status: 'maintenance', lastHeartbeat: '2026-06-27T10:00:00' },
];

async function seedDevices() {
  try {
    const existing = await devDb.query(`SELECT COUNT(*) AS cnt FROM DEVICES`, []);
    if (parseInt(existing.rows[0].cnt) > 0) {
      console.log(`DEVICES table already has ${existing.rows[0].cnt} rows, clearing...`);
      await devDb.query(`DELETE FROM DEVICES`, []);
      await devDb.query(`DELETE FROM DEVICE_HEARTBEATS`, []);
    }

    for (const d of devices) {
      await devDb.query(
        `INSERT INTO DEVICES (device_id, location_id, hardware_type, firmware_version, status, last_heartbeat, created_at, updated_at)
         VALUES (@p1, @p2, @p3, @p4, @p5, @p6, GETDATE(), GETDATE())`,
        [d.deviceId, d.locationId, d.hardwareType, d.firmwareVersion, d.status, d.lastHeartbeat]
      );
      console.log(`Created device: ${d.deviceId}`);
    }

    const count = await devDb.query(`SELECT COUNT(*) AS cnt FROM DEVICES`, []);
    console.log(`Seed complete. ${count.rows[0].cnt} devices`);
    process.exit(0);
  } catch (err) {
    console.error('Device seed error:', err);
    process.exit(1);
  }
}

seedDevices();
