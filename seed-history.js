const devDb = require('./services/dev-db');

async function seedHistory() {
  try {
    const existing = await devDb.query(`SELECT COUNT(*) AS cnt FROM HISTORY`, []);
    if (parseInt(existing.rows[0].cnt) > 0) {
      console.log(`HISTORY table already has ${existing.rows[0].cnt} rows, clearing...`);
      await devDb.query(`DELETE FROM HISTORY`, []);
    }

    const entries = [
      { accId: 7, message: 'Account created: Main HQ' },
      { accId: 7, message: 'Account billing address updated' },
      { locId: 3, message: 'Location activated: Main HQ Site' },
      { locId: 4, message: 'Location hours updated for weekend' },
      { plaId: 1, message: 'Platform configuration updated: Instagram' },
      { plaId: 3, message: 'Platform API key regenerated: TikTok' },
      { plaId: 9, message: 'Platform integration enabled: Google Business' },
      { locId: 5, message: 'Location subscription plan changed to Premium' },
      { accId: 8, message: 'Account payment method updated' },
      { locId: 3, message: 'Location device assignment changed' },
      { deviceId: 'STOREFRONT-001', message: 'Device firmware upgraded to v2.1.0' },
      { deviceId: 'DEMO-SIGN-001', message: 'Digital sign content updated for summer campaign' },
      { deviceId: '18c5778e136290dd', message: 'Device placed in maintenance mode for hardware repair' },
      { deviceId: 'DEMO-SIGN-002', message: 'Device heartbeat lost for 15 minutes, alert sent' },
      { locId: 5, message: 'New location onboarded: West Coast Site' },
      { accId: 9, message: 'Account subscription renewed for annual term' },
      { deviceId: 'SF-TEST-001', message: 'Kiosk touch screen recalibrated remotely' },
      { locId: 4, message: 'Location signage configuration updated' },
      { plaId: 2, message: 'Platform SSL certificate refreshed: Facebook' },
      { deviceId: 'SF-TEST-002', message: 'Digital sign reported offline, investigation started' },
      { accId: 7, message: 'Account admin user permissions modified' },
      { locId: 3, message: 'Location network configuration updated for new ISP' },
      { deviceId: 'STOREFRONT-001', message: 'Tablet replaced at front desk due to hardware failure' },
      { plaId: 5, message: 'New platform connected: Twitter / X' },
    ];

    for (const e of entries) {
      const now = new Date(Date.now() - Math.floor(Math.random() * 7 * 86400000));
      await devDb.query(
        `INSERT INTO HISTORY (HIS_ACC_ID, HIS_LOC_ID, HIS_PLA_ID, HIS_DEVICEID, HIS_MESSAGE, HIS_DATE_INSERTED)
         VALUES (@p1, @p2, @p3, @p4, @p5, @p6)`,
        [e.accId || null, e.locId || null, e.plaId || null, e.deviceId || null, e.message, now]
      );
    }

    const count = await devDb.query(`SELECT COUNT(*) AS cnt FROM HISTORY`, []);
    console.log(`Seed complete. ${count.rows[0].cnt} history entries`);
    process.exit(0);
  } catch (err) {
    console.error('History seed error:', err);
    process.exit(1);
  }
}

seedHistory();
