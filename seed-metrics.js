const devDb = require('./services/dev-db');

const metrics = [
  { id: 1, title: 'Revenue', query: 'SELECT SUM(amount) FROM transactions', goal: 100000, units: '$', frequency: 'M', direction: 'H', desc: 'Total monthly revenue from all sources' },
  { id: 2, title: 'Active Users', query: 'SELECT COUNT(DISTINCT user_id) FROM sessions', goal: 5000, units: '', frequency: 'D', direction: 'H', desc: 'Daily active users across all platforms' },
  { id: 3, title: 'Order Conversion', query: 'SELECT (completed / total) * 100 FROM orders', goal: 75, units: '%', frequency: 'D', direction: 'H', desc: 'Percentage of visitors who complete an order' },
  { id: 4, title: 'Avg Response Time', query: 'SELECT AVG(response_time) FROM support_tickets', goal: 24, units: 'h', frequency: 'D', direction: 'L', desc: 'Average hours to first response on support tickets' },
  { id: 5, title: 'Customer Churn', query: 'SELECT COUNT(*) FROM cancellations', goal: 5, units: '%', frequency: 'M', direction: 'L', desc: 'Monthly customer churn rate' },
  { id: 6, title: 'NPS Score', query: 'SELECT AVG(score) FROM surveys', goal: 70, units: '', frequency: 'M', direction: 'H', desc: 'Net Promoter Score from customer surveys' },
  { id: 7, title: 'Page Load Time', query: 'SELECT AVG(load_time) FROM perf_metrics', goal: 2, units: 's', frequency: 'D', direction: 'L', desc: 'Average page load time in seconds' },
  { id: 8, title: 'New Signups', query: 'SELECT COUNT(*) FROM users', goal: 1000, units: '', frequency: 'W', direction: 'H', desc: 'Weekly new user signups' },
];

// Metric values to seed (latest snapshot for each active metric)
const metricValues = [
  { metId: 1, value: 78500, pct: 79, date: '2026-06-28' },
  { metId: 2, value: 4200, pct: 84, date: '2026-06-30' },
  { metId: 3, value: 62, pct: 83, date: '2026-06-30' },
  { metId: 4, value: 18, pct: 75, date: '2026-06-30' },
  { metId: 5, value: 4.2, pct: 84, date: '2026-06-01' },
  { metId: 6, value: 65, pct: 93, date: '2026-05-31' },
  { metId: 7, value: 1.8, pct: 90, date: '2026-06-30' },
  { metId: 8, value: 850, pct: 85, date: '2026-06-29' },
];

async function seedMetrics() {
  try {
    await devDb.query(`ALTER TABLE METRIC ALTER COLUMN MET_TITLE NVARCHAR(100) NOT NULL`);
    await devDb.query(`ALTER TABLE METRIC ALTER COLUMN MET_QUERY NVARCHAR(MAX)`);
    await devDb.query(`ALTER TABLE METRIC ALTER COLUMN MET_UNITS NVARCHAR(10)`);
    await devDb.query(`ALTER TABLE METRIC ALTER COLUMN MET_DESCRIPTION NVARCHAR(MAX)`);
    await devDb.query(`ALTER TABLE METRIC_VALUE ALTER COLUMN MV_VALUE DECIMAL(18,2)`);
    console.log('Ensured METRIC and METRIC_VALUE columns are wide enough');

    for (const m of metrics) {
      const existing = await devDb.query(`SELECT MET_ID FROM METRIC WHERE MET_ID = @p1`, [m.id]);
      if (existing.rows.length === 0) {
        await devDb.query(
          `INSERT INTO METRIC (MET_ID, MET_TITLE, MET_QUERY, MET_GOAL, MET_STATUS, MET_DATE_INSERTED, MET_DATE_UPDATED, MET_DIRECTION, MET_UNITS, MET_RUN_FREQUENCY, MET_DESCRIPTION)
           VALUES (@p1, @p2, @p3, @p4, 'A', GETDATE(), GETDATE(), @p5, @p6, @p7, @p8)`,
          [m.id, m.title, m.query, m.goal, m.direction, m.units, m.frequency, m.desc]
        );
        console.log(`Created metric: ${m.title} (ID ${m.id})`);
      } else {
        console.log(`Metric ${m.id} already exists, skipping`);
      }
    }

    for (const mv of metricValues) {
      const existing = await devDb.query(
        `SELECT MV_ID FROM METRIC_VALUE WHERE MV_MET_ID = @p1 AND MV_DATE = @p2`,
        [mv.metId, mv.date]
      );
      if (existing.rows.length === 0) {
        await devDb.query(
          `INSERT INTO METRIC_VALUE (MV_MET_ID, MV_VALUE, MV_PCT_OF_GOAL, MV_DATE, MV_DATE_UPDATED)
           VALUES (@p1, @p2, @p3, @p4, GETDATE())`,
          [mv.metId, mv.value, mv.pct, mv.date]
        );
        console.log(`Created metric value for MET_ID ${mv.metId}: ${mv.value} (${mv.pct}%)`);
      }
    }

    const mCount = await devDb.query(`SELECT COUNT(*) AS cnt FROM METRIC`);
    const mvCount = await devDb.query(`SELECT COUNT(*) AS cnt FROM METRIC_VALUE`);
    console.log(`Seed complete. ${mCount.rows[0].cnt} metrics, ${mvCount.rows[0].cnt} values`);
    process.exit(0);
  } catch (err) {
    console.error('Metric seed error:', err);
    process.exit(1);
  }
}

seedMetrics();
