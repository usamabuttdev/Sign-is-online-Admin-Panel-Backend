const devDb = require('./services/dev-db');

const apiEndpoints = [
  { title: 'Get Users', description: 'Retrieve a list of all users', calls24h: 15230, calls1h: 620, queued: 5 },
  { title: 'Create User', description: 'Create a new user account', calls24h: 3420, calls1h: 140, queued: 2 },
  { title: 'Update User', description: 'Update existing user details', calls24h: 8910, calls1h: 380, queued: 3 },
  { title: 'Delete User', description: 'Remove a user account', calls24h: 1200, calls1h: 50, queued: 0 },
  { title: 'Get Products', description: 'List all available products', calls24h: 28400, calls1h: 1150, queued: 12 },
  { title: 'Create Product', description: 'Add a new product to the catalog', calls24h: 890, calls1h: 35, queued: 1 },
  { title: 'Process Payment', description: 'Process a payment transaction', calls24h: 5600, calls1h: 230, queued: 8 },
  { title: 'Generate Report', description: 'Generate a sales or performance report', calls24h: 430, calls1h: 18, queued: 15 },
  { title: 'Send Notification', description: 'Send a push or email notification', calls24h: 12500, calls1h: 520, queued: 45 },
  { title: 'Health Check', description: 'Check API service health status', calls24h: 48000, calls1h: 2000, queued: 0 },
];

async function seedApiEndpoints() {
  try {
    const existing = await devDb.query(`SELECT COUNT(*) AS cnt FROM API_ENDPOINTS`, []);
    if (parseInt(existing.rows[0].cnt) > 0) {
      console.log(`API_ENDPOINTS table already has ${existing.rows[0].cnt} rows, clearing...`);
      await devDb.query(`DELETE FROM API_ENDPOINTS`, []);
    }

    for (const ep of apiEndpoints) {
      await devDb.query(
        `INSERT INTO API_ENDPOINTS (API_TITLE, API_DESCRIPTION, API_CALLS_24H, API_CALLS_1H, API_QUEUED, API_CREATED_AT)
         VALUES (@p1, @p2, @p3, @p4, @p5, CURRENT_TIMESTAMP)`,
        [ep.title, ep.description, ep.calls24h, ep.calls1h, ep.queued]
      );
      console.log(`Created API endpoint: ${ep.title}`);
    }

    const count = await devDb.query(`SELECT COUNT(*) AS cnt FROM API_ENDPOINTS`, []);
    console.log(`Seed complete. ${count.rows[0].cnt} API endpoints`);
    process.exit(0);
  } catch (err) {
    console.error('API endpoints seed error:', err);
    process.exit(1);
  }
}

seedApiEndpoints();
