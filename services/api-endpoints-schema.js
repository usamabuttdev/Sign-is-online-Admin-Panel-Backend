const db = require('../db');

async function initializeApiEndpointsSchema() {
  try {
    await db.query(`
      IF NOT EXISTS (SELECT * FROM sys.sequences WHERE name = 'API_SEQ')
        CREATE SEQUENCE API_SEQ START WITH 1 INCREMENT BY 1
    `);
    await db.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='API_ENDPOINTS' AND xtype='U')
        CREATE TABLE API_ENDPOINTS (
          API_ID INT PRIMARY KEY DEFAULT NEXT VALUE FOR API_SEQ,
          API_TITLE NVARCHAR(255) NOT NULL,
          API_DESCRIPTION NVARCHAR(MAX),
          API_CALLS_24H INT DEFAULT 0,
          API_CALLS_1H INT DEFAULT 0,
          API_QUEUED INT DEFAULT 0,
          API_CREATED_AT DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    `);
    console.log('API_ENDPOINTS table schema initialized');
    await db.query(`
      IF COL_LENGTH('API_ENDPOINTS', 'API_STATUS') IS NULL
        ALTER TABLE API_ENDPOINTS ADD API_STATUS CHAR(1) NOT NULL CONSTRAINT DF_API_ENDPOINTS_STATUS DEFAULT 'A'
    `);
    console.log('API_ENDPOINTS.API_STATUS column ensured');
  } catch (err) {
    console.error('API_ENDPOINTS schema init error:', err.message);
  }
}

module.exports = initializeApiEndpointsSchema;
