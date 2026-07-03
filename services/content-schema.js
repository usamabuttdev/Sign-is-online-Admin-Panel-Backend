const db = require('../db');

async function initializeContentSchema() {
  try {
    await db.query(`
      IF NOT EXISTS (SELECT * FROM sys.sequences WHERE name = 'CON_SEQ')
        CREATE SEQUENCE CON_SEQ START WITH 1 INCREMENT BY 1
    `);
    await db.query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='CONTENT' AND xtype='U')
        CREATE TABLE CONTENT (
          CON_ID INT PRIMARY KEY DEFAULT NEXT VALUE FOR CON_SEQ,
          CON_TITLE NVARCHAR(35) NOT NULL,
          CON_HTML NVARCHAR(MAX),
          CON_DATE_INSERTED DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
          CON_DATE_UPDATED DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
    `);
    console.log('CONTENT table schema initialized');
  } catch (err) {
    console.error('CONTENT schema init error:', err.message);
  }
}

module.exports = initializeContentSchema;
