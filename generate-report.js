const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'report-data.json');
const htmlPath = path.join(__dirname, 'report.html');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

function formatDate(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toISOString().split('T')[0];
}

function describeInsight(metric) {
  if (metric.currentValue === null) return 'Awaiting first value.';

  const goal = metric.goal;
  const directionHint = metric.direction === 'L' ? 'lower' : 'higher';
  const progress = goal ? `${((metric.currentValue / goal) * 100).toFixed(1)}%` : 'N/A';

  if (goal && metric.direction === 'H') {
    if (metric.currentValue >= goal) return 'Goal met or exceeded; maintain momentum.';
    if (metric.currentValue >= goal * 0.9) return 'Close to goal; small tweaks could push it over the line.';
    return 'Need to accelerate efforts; still below 90% of the goal.';
  }

  if (goal && metric.direction === 'L') {
    if (metric.currentValue <= goal) return 'Performing well below the ceiling; keep processes steady.';
    if (metric.currentValue <= goal * 1.1) return 'Slightly above target; monitor to avoid drift.';
    return 'Above acceptable threshold; investigate root cause.';
  }

  return `Currently ${progress} of the qualitative target; focus on ${directionHint}.`;
}

function buildHistoryChart(metric) {
  const history = metric.history || [];
  if (history.length === 0) return '<div class="empty-state">No history yet.</div>';

  const values = history.map(v => Math.abs(v.value || 0));
  const maxVal = Math.max(...values, Math.abs(metric.goal || 0), Math.abs(metric.currentValue || 0), 1);

  const bars = history
    .map((entry, idx) => {
      const height = Math.round((Math.abs(entry.value || 0) / maxVal) * 100);
      const label = formatDate(entry.date);
      return `
        <div class="bar" style="height:${height}%;" title="${label}: ${entry.value}${metric.units}">
          <span>${label}</span>
        </div>`;
    })
    .join('');

  return `<div class="chart-grid">${bars}</div>`;
}

const sections = data.map(metric => {
  const trendDetails = [];
  if (metric.previousValue !== null) {
    let trend = 'No change data.';
    if (typeof metric.pctChange === 'number') {
      const sign = metric.pctChange > 0 ? '+' : '';
      trend = `${sign}${metric.pctChange.toFixed(1)}% vs prior period.`;
    }
    trendDetails.push(`<strong>Prior week comparison:</strong> ${trend}`);
  } else {
    trendDetails.push('<strong>Prior week comparison:</strong> Not available yet.');
  }

  const insight = describeInsight(metric);

  return `
    <section class="metric-page">
      <header>
        <p class="kicker">Metric ${metric.id}</p>
        <h1>${metric.title}</h1>
        <p class="description">${metric.description || '—'}</p>
      </header>
      <div class="metric-body">
        <div class="metric-summary">
          <div>
            <span class="label">Current</span>
            <p class="value">${metric.currentValue !== null ? metric.currentValue : '—'} ${metric.units || ''}</p>
            <span class="sub">as of ${formatDate(metric.currentDate)}</span>
          </div>
          <div>
            <span class="label">Goal</span>
            <p class="value">${metric.goal !== null && metric.goal !== undefined ? metric.goal : 'TBD'} ${metric.units || ''}</p>
            <span class="sub">${metric.direction === 'H' ? 'Higher is better' : 'Lower is better'}</span>
          </div>
          <div>
            <span class="label">Bridge</span>
            <p class="value">${metric.currentPct !== null ? metric.currentPct + '%' : '—'}</p>
            <span class="sub">% of target</span>
          </div>
        </div>
        <div class="chart-block">
          <p class="chart-title">History</p>
          ${buildHistoryChart(metric)}
        </div>
      </div>
      <div class="insights">
        <p>${insight}</p>
        ${trendDetails.map(item => `<p>${item}</p>`).join('')}
      </div>
    </section>
  `;
});

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Weekly Metrics Report</title>
  <style>
    :root {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      color: #0f172a;
      background: #f6f9fc;
    }
    body {
      margin: 0;
      padding: 0;
      background: #f6f9fc;
    }
    .metric-page {
      page-break-after: always;
      background: white;
      padding: 2.4cm;
      min-height: 297mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    header h1 {
      margin: 0.2rem 0;
      font-size: 2.8rem;
      letter-spacing: -0.02em;
      color: #0c4a6e;
    }
    .kicker {
      font-size: 0.95rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #475569;
    }
    .description {
      margin: 0;
      color: #475569;
      max-width: 42ch;
      font-size: 1rem;
    }
    .metric-body {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.2rem;
    }
    .metric-summary {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .metric-summary > div {
      flex: 1;
      min-width: 150px;
      background: #eef2ff;
      padding: 1.1rem;
      border-radius: 0.9rem;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
    }
    .label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #475569;
    }
    .value {
      margin: 0.2rem 0;
      font-size: 2rem;
      color: #111827;
    }
    .sub {
      color: #475569;
      font-size: 0.9rem;
    }
    .chart-block {
      background: #ffffff;
      border-radius: 1rem;
      padding: 1.2rem;
      box-shadow: 0 6px 20px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
      min-height: 220px;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .chart-title {
      margin: 0;
      font-weight: 600;
      color: #0f172a;
    }
    .chart-grid {
      display: flex;
      gap: 0.4rem;
      align-items: flex-end;
      height: 140px;
    }
    .bar {
      flex: 1;
      background: linear-gradient(180deg, #3b82f6, #2563eb);
      border-radius: 0.5rem 0.5rem 0 0;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      align-items: center;
      position: relative;
    }
    .bar span {
      font-size: 0.7rem;
      color: #e0e7ff;
      margin-bottom: 0.4rem;
    }
    .insights {
      background: #111827;
      color: white;
      padding: 1.5rem;
      border-radius: 1rem;
      line-height: 1.7;
    }
    .insights p {
      margin: 0;
    }
    .empty-state {
      font-size: 1rem;
      color: #94a3b8;
      padding: 0.8rem;
    }
  </style>
</head>
<body>
  ${sections.join('')}
</body>
</html>
`;

fs.writeFileSync(htmlPath, html);
console.log(`Generated report HTML at ${htmlPath}`);
