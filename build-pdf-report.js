const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const dataPath = path.join(__dirname, 'report-data.json');
const pdfPath = path.join(__dirname, 'weekly-metrics-report.pdf');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

function formatDate(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toISOString().split('T')[0];
}

function describeInsight(metric) {
  if (metric.currentValue === null) return 'Awaiting first value.';

  const goal = metric.goal;
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

  return 'Solid progress; continue monitoring this metric.';
}

const doc = new PDFDocument({ size: 'A4', margin: 54 });
doc.pipe(fs.createWriteStream(pdfPath));

data.forEach((metric, index) => {
  if (index > 0) doc.addPage();

  doc.font('Helvetica-Bold').fontSize(24).fillColor('#0c4a6e').text(`#${metric.id} • ${metric.title}`, {continued: false});
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(12).fillColor('#475569').text(metric.description || '—');

  doc.moveDown(0.6);
  const summaryY = doc.y;
  const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 3;

  const summaryItems = [
    {
      label: 'Current',
      value: metric.currentValue !== null ? `${metric.currentValue} ${metric.units || ''}` : '—',
      detail: `as of ${formatDate(metric.currentDate)}`,
    },
    {
      label: 'Goal',
      value: metric.goal !== null && metric.goal !== undefined ? `${metric.goal} ${metric.units || ''}` : 'TBD',
      detail: metric.direction === 'H' ? 'Higher is better' : 'Lower is better',
    },
    {
      label: 'Progress',
      value: metric.currentPct !== null ? `${metric.currentPct}% of target` : '—',
      detail: metric.frequency ? `${metric.frequency} cadence` : '—',
    },
  ];

  summaryItems.forEach((item, idx) => {
    const x = doc.x + idx * colWidth;
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(item.label, x, summaryY);
    doc.font('Helvetica-Bold').fontSize(20).text(item.value, {indent: 0, continued: false}, x, doc.y);
    doc.font('Helvetica').fontSize(10).fillColor('#64748b').text(item.detail, {indent: 0, continued: false}, x, doc.y);
  });

  doc.moveDown(1);
  const chartWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const chartHeight = 150;
  doc.rect(doc.x, doc.y, chartWidth, chartHeight).strokeColor('#cbd5f5').lineWidth(1).stroke();

  const history = metric.history || [];
  if (history.length > 0) {
    const maxVal = Math.max(...history.map(h => Math.abs(h.value || 0)), Math.abs(metric.goal || 0), Math.abs(metric.currentValue || 0), 1);
    const barWidth = chartWidth / Math.max(1, history.length);

    history.forEach((entry, idx) => {
      const value = Math.abs(entry.value || 0);
      const height = ((value / maxVal) * (chartHeight - 20));
      const barX = doc.x + idx * barWidth + 10;
      const barY = doc.y + chartHeight - height - 10;
      doc.rect(barX, barY, barWidth - 14, height).fillColor('#38bdf8').fill();
      doc.font('Helvetica').fontSize(8).fillColor('#0f172a').text(formatDate(entry.date), barX, doc.y + chartHeight - 10, {width: barWidth - 14, align: 'center'});
    });
  } else {
    doc.font('Helvetica-Oblique').fontSize(12).fillColor('#94a3b8').text('No historical data available yet.', doc.x + 10, doc.y + chartHeight / 2 - 6);
  }

  doc.moveDown(2);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text('Key Insights');
  doc.font('Helvetica').fontSize(12).fillColor('#111827').text(describeInsight(metric));

  doc.moveDown(0.2);
  if (metric.previousValue !== null) {
    const change = typeof metric.pctChange === 'number' ? `${metric.pctChange >= 0 ? '+' : ''}${metric.pctChange.toFixed(1)}%` : 'N/A';
    doc.font('Helvetica').fontSize(12).fillColor('#111827').text(`Previous period: ${metric.previousValue} ${metric.units || ''} (${change})`);
  } else {
    doc.font('Helvetica').fontSize(12).fillColor('#111827').text('Previous period: data not available yet.');
  }
});

doc.end();
console.log(`PDF report created at ${pdfPath}`);
