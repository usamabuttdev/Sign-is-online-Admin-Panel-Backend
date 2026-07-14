const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const config = {
  server: 'dev.cqv82ucmgull.us-east-1.rds.amazonaws.com',
  port: 1433,
  user: 'IO_JUYI_Avy_zi8w',
  password: 'SimplePass123?',
  database: 'STOREFRONT',
  options: { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

async function main() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.error('Connected to MSSQL database');

    // Get all active metrics with their last value
    const metricsResult = await pool.request().query(`
      SELECT
        m.MET_ID AS id,
        m.MET_TITLE AS title,
        m.MET_QUERY AS query_text,
        m.MET_GOAL AS goal,
        m.MET_UNITS AS units,
        m.MET_DIRECTION AS direction,
        m.MET_RUN_FREQUENCY AS frequency,
        m.MET_DESCRIPTION AS description
      FROM METRIC m
      WHERE m.MET_STATUS = 'A'
      ORDER BY m.MET_ID
    `);
    const metrics = metricsResult.recordset;
    console.error(`Found ${metrics.length} active metrics`);

    // For each metric, get historical values (all)
    const reportData = [];
    for (const m of metrics) {
      const valuesResult = await pool.request()
        .input('metId', sql.Int, m.id)
        .query(`
          SELECT
            MV_ID AS id,
            MV_VALUE AS value,
            MV_PCT_OF_GOAL AS percent_of_goal,
            MV_DATE AS date
          FROM METRIC_VALUE
          WHERE MV_MET_ID = @metId
          ORDER BY MV_DATE DESC, MV_ID DESC
        `);
      const values = valuesResult.recordset;

      const currentValue = values.length > 0 ? values[0].value : null;
      const currentPct = values.length > 0 ? values[0].percent_of_goal : null;
      const currentDate = values.length > 0 ? values[0].date : null;
      const previousValue = values.length > 1 ? values[1].value : null;
      const previousPct = values.length > 1 ? values[1].percent_of_goal : null;

      let pctChange = null;
      if (currentValue !== null && previousValue !== null && previousValue !== 0) {
        pctChange = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
      }

      reportData.push({
        id: m.id,
        title: m.title,
        query: m.query_text,
        goal: m.goal,
        units: m.units,
        direction: m.direction,
        frequency: m.frequency,
        description: m.description,
        currentValue,
        currentPct,
        currentDate,
        previousValue,
        previousPct,
        pctChange,
        history: values.map(v => ({ date: v.date, value: v.value, pct: v.percent_of_goal })),
      });
    }

    // Output as JSON to stdout
    const outputPath = path.join(__dirname, 'report-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(reportData, null, 2));
    console.log(outputPath);
  } catch (err) {
    console.error('Database error:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main();
