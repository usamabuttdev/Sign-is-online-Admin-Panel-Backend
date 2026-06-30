const devDb = require('./services/dev-db');

const scripts = [
  {
    id: 1,
    title: 'Backup Database',
    run_frequency: 'D',
    last_started: '2026-06-30T02:00:00',
    last_checked: '2026-06-30T02:30:00',
    status: 'A',
    server_name: 'DB-Server-01',
    description: 'Full nightly database backup to offsite storage.',
    email_address: 'admin@storefrontworks.com',
    track_counts: 'Y',
    check_frequency: 30,
    check_range: 60,
  },
  {
    id: 2,
    title: 'Cleanup Temp Files',
    run_frequency: 'W',
    last_started: '2026-06-28T03:00:00',
    last_checked: '2026-06-28T03:15:00',
    status: 'A',
    server_name: 'App-Server-02',
    description: 'Weekly cleanup of temporary and cache files.',
    email_address: 'admin@storefrontworks.com',
    track_counts: 'Y',
    check_frequency: 60,
    check_range: 120,
  },
  {
    id: 3,
    title: 'Analytics Rollup',
    run_frequency: 'H',
    last_started: '2026-06-30T13:00:00',
    last_checked: '2026-06-30T13:05:00',
    status: 'A',
    server_name: 'Analytics-Server',
    description: 'Hourly aggregation of analytics data from all sources.',
    email_address: 'analytics@storefrontworks.com',
    track_counts: 'Y',
    check_frequency: 10,
    check_range: 30,
  },
  {
    id: 4,
    title: 'Email Notification Dispatch',
    run_frequency: 'N',
    last_started: '2026-06-30T13:30:00',
    last_checked: '2026-06-30T13:30:00',
    status: 'A',
    server_name: 'Mail-Server',
    description: 'Continuous dispatch of queued email notifications.',
    email_address: 'noreply@storefrontworks.com',
    track_counts: 'N',
    check_frequency: 5,
    check_range: 15,
  },
  {
    id: 5,
    title: 'Failed Login Monitor',
    run_frequency: 'N',
    last_started: '2026-06-30T13:29:00',
    last_checked: '2026-06-30T13:29:00',
    status: 'F',
    server_name: 'Security-Server',
    description: 'Monitor for repeated failed login attempts.',
    email_address: 'security@storefrontworks.com',
    track_counts: 'Y',
    check_frequency: 1,
    check_range: 5,
    failure_info: 'Connection timeout to auth database',
  },
  {
    id: 6,
    title: 'SSL Certificate Check',
    run_frequency: 'M',
    last_started: '2026-06-01T08:00:00',
    last_checked: '2026-06-01T08:02:00',
    status: 'A',
    server_name: 'Proxy-Server',
    description: 'Monthly check of SSL certificate expiry dates.',
    email_address: 'admin@storefrontworks.com',
    track_counts: 'N',
    check_frequency: 1440,
    check_range: 2880,
  },
  {
    id: 7,
    title: 'User Data Sync',
    run_frequency: 'D',
    last_started: '2026-06-30T04:00:00',
    last_checked: '2026-06-30T04:20:00',
    status: 'A',
    server_name: 'Sync-Server',
    description: 'Daily synchronization of user data across platforms.',
    email_address: 'admin@storefrontworks.com',
    track_counts: 'Y',
    check_frequency: 60,
    check_range: 120,
  },
];

async function seedScripts() {
  try {
    await devDb.query(`ALTER TABLE SCRIPT ALTER COLUMN SCR_TITLE NVARCHAR(200) NOT NULL`);
    await devDb.query(`ALTER TABLE SCRIPT ALTER COLUMN SCR_SERVER_NAME NVARCHAR(100)`);
    await devDb.query(`ALTER TABLE SCRIPT ALTER COLUMN SCR_DESCRIPTION NVARCHAR(MAX)`);
    await devDb.query(`ALTER TABLE SCRIPT ALTER COLUMN SCR_EMAIL_ADDRESS NVARCHAR(200)`);
    await devDb.query(`ALTER TABLE SCRIPT ALTER COLUMN SCR_FAILURE_INFO NVARCHAR(MAX)`);
    await devDb.query(`ALTER TABLE SCRIPT_LOG ALTER COLUMN SL_LOG_DETAIL NVARCHAR(MAX)`);
    await devDb.query(`ALTER TABLE SCRIPT_LOG ALTER COLUMN SL_SERVER NVARCHAR(100)`);
    console.log('Ensured SCRIPT and SCRIPT_LOG columns are wide enough');

    for (const s of scripts) {
      const existing = await devDb.query(`SELECT SCR_ID FROM SCRIPT WHERE SCR_ID = @p1`, [s.id]);
      if (existing.rows.length === 0) {
        await devDb.query(
          `INSERT INTO SCRIPT (SCR_ID, SCR_TITLE, SCR_RUN_FREQUENCY, SCR_DATE_LAST_STARTED, SCR_DATE_LAST_CHECKED, SCR_LAST_CHECK_STATUS, SCR_STATUS, SCR_DATE_INSERTED, SCR_DATE_UPDATED, SCR_SERVER_NAME, SCR_DESCRIPTION, SCR_EMAIL_ADDRESS, SCR_TRACK_COUNTS, SCR_CHECK_FREQUENCY, SCR_CHECK_RANGE, SCR_FAILURE_INFO)
           VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, GETDATE(), GETDATE(), @p8, @p9, @p10, @p11, @p12, @p13, @p14)`,
          [s.id, s.title, s.run_frequency, s.last_started, s.last_checked, s.status === 'A' ? 'S' : 'F', s.status,
           s.server_name, s.description, s.email_address, s.track_counts, s.check_frequency, s.check_range,
           s.failure_info || null]
        );
        console.log(`Created script: ${s.title} (ID ${s.id})`);
      } else {
        console.log(`Script ${s.id} already exists, skipping`);
      }
    }

    const logEntries = [];
    const now = new Date();
    for (const s of scripts) {
      const numLogs = s.run_frequency === 'H' ? 12 : s.run_frequency === 'N' ? 20 : s.run_frequency === 'D' ? 7 : 4;
      for (let i = 0; i < numLogs; i++) {
        const date = new Date(now.getTime() - i * (s.run_frequency === 'H' ? 3600000 : s.run_frequency === 'N' ? 300000 : 86400000));
        logEntries.push({
          scriptId: s.id,
          processTime: Math.floor(Math.random() * 300) + 5,
          processCount: Math.floor(Math.random() * 500) + 10,
          dateStarted: date,
          dateEnded: new Date(date.getTime() + (Math.floor(Math.random() * 120) + 5) * 1000),
          logDetail: i === 0 && s.status === 'F' ? 'Script execution failed: ' + s.failure_info : 'Process completed successfully',
          server: s.server_name,
        });
      }
    }

    for (const log of logEntries) {
      await devDb.query(
        `INSERT INTO SCRIPT_LOG (SL_SCR_ID, SL_PROCESS_TIME, SL_PROCESS_COUNT, SL_DATE_STARTED, SL_DATE_ENDED, SL_LOG_DETAIL, SL_SERVER)
         VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7)`,
        [log.scriptId, log.processTime, log.processCount, log.dateStarted, log.dateEnded, log.logDetail, log.server]
      );
    }

    const sCount = await devDb.query(`SELECT COUNT(*) AS cnt FROM SCRIPT`);
    const lCount = await devDb.query(`SELECT COUNT(*) AS cnt FROM SCRIPT_LOG`);
    console.log(`Seed complete. ${sCount.rows[0].cnt} scripts, ${lCount.rows[0].cnt} log entries`);
    process.exit(0);
  } catch (err) {
    console.error('Script seed error:', err);
    process.exit(1);
  }
}

seedScripts();
