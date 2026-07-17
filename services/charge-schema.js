const db = require('../db');

async function initializeChargeSchema() {
  try {
    await db.query(`
      IF COL_LENGTH('CHARGE', 'CHA_STATUS') IS NULL
        ALTER TABLE CHARGE ADD CHA_STATUS CHAR(1) NOT NULL CONSTRAINT DF_CHARGE_CHA_STATUS DEFAULT 'A'
    `);
    console.log('CHARGE.CHA_STATUS column ensured');

    // Legacy schema had INV_NUMBER as varchar(1) — too short for real invoice numbers.
    await db.query(`
      IF COL_LENGTH('INVOICE', 'INV_NUMBER') IS NOT NULL
        AND COL_LENGTH('INVOICE', 'INV_NUMBER') <= 2
      BEGIN
        ALTER TABLE INVOICE ALTER COLUMN INV_NUMBER VARCHAR(40) NOT NULL
      END
    `);
    console.log('INVOICE.INV_NUMBER width ensured');
  } catch (err) {
    console.error('CHARGE schema init error:', err.message);
  }
}

module.exports = initializeChargeSchema;
