const db = require('../db');

/**
 * Seed scripts often INSERT with explicit IDs, which leaves identity sequences behind.
 * Resync each sequence to MAX(pk)+1 so DEFAULT NEXT VALUE FOR ... does not collide.
 */
const SEQUENCE_SYNC = [
  { sequence: 'PLA_SEQ', table: 'PLATFORM', column: 'PLA_ID' },
  { sequence: 'PRO_SEQ', table: 'PRODUCT', column: 'PRO_ID' },
  { sequence: 'PP_SEQ', table: 'PRODUCT_PRICE', column: 'PP_ID' },
  { sequence: 'ACC_SEQ', table: 'ACCOUNT', column: 'ACC_ID' },
  { sequence: 'MET_SEQ', table: 'METRIC', column: 'MET_ID' },
  { sequence: 'LOC_SEQ', table: 'LOCATION', column: 'LOC_ID' },
  { sequence: 'CHA_SEQ', table: 'CHARGE', column: 'CHA_ID' },
  { sequence: 'API_SEQ', table: 'API_ENDPOINTS', column: 'API_ID' },
  { sequence: 'SCR_SEQ', table: 'SCRIPT', column: 'SCR_ID' },
  { sequence: 'INV_SEQ', table: 'INVOICE', column: 'INV_ID' },
];

async function syncSequence({ sequence, table, column }) {
  const maxResult = await db.query(
    `SELECT ISNULL(MAX(${column}), 0) AS max_id FROM ${table}`
  );
  const maxId = Number(maxResult.rows[0]?.max_id) || 0;
  const nextVal = maxId + 1;

  const exists = await db.query(
    `SELECT 1 AS ok FROM sys.sequences WHERE name = @p1`,
    [sequence]
  );
  if (!exists.rows.length) return;

  // RESTART WITH requires a literal integer — only use a sanitized number.
  if (!Number.isFinite(nextVal) || nextVal < 1 || !Number.isInteger(nextVal)) {
    throw new Error(`Invalid restart value for ${sequence}: ${nextVal}`);
  }

  await db.query(`ALTER SEQUENCE ${sequence} RESTART WITH ${nextVal}`);
  return { sequence, maxId, nextVal };
}

async function initializeSequences() {
  try {
    const synced = [];
    for (const entry of SEQUENCE_SYNC) {
      try {
        const result = await syncSequence(entry);
        if (result) synced.push(result);
      } catch (err) {
        console.warn(`Sequence sync skipped for ${entry.sequence}:`, err.message);
      }
    }
    if (synced.length) {
      console.log(
        'MSSQL sequences synced:',
        synced.map((s) => `${s.sequence}->${s.nextVal}`).join(', ')
      );
    }
  } catch (err) {
    console.error('Sequence sync init error:', err.message);
  }
}

module.exports = initializeSequences;
module.exports.syncSequence = syncSequence;
module.exports.SEQUENCE_SYNC = SEQUENCE_SYNC;
