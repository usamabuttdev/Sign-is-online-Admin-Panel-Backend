const db = require('../db');

async function initializeChargeSchema() {
  try {
    await db.query(`
      IF COL_LENGTH('CHARGE', 'CHA_STATUS') IS NULL
        ALTER TABLE CHARGE ADD CHA_STATUS CHAR(1) NOT NULL CONSTRAINT DF_CHARGE_CHA_STATUS DEFAULT 'A'
    `);
    console.log('CHARGE.CHA_STATUS column ensured');
  } catch (err) {
    console.error('CHARGE schema init error:', err.message);
  }
}

module.exports = initializeChargeSchema;
