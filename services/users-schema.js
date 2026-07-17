const db = require('../db');

async function initializeUsersSchema() {
  try {
    await db.query(`
      IF COL_LENGTH('Users', 'IsActive') IS NULL AND COL_LENGTH('users', 'IsActive') IS NULL
      BEGIN
        IF OBJECT_ID('Users', 'U') IS NOT NULL
          ALTER TABLE Users ADD IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1
        ELSE IF OBJECT_ID('users', 'U') IS NOT NULL
          ALTER TABLE users ADD IsActive BIT NOT NULL CONSTRAINT DF_users_IsActive DEFAULT 1
      END
    `);
    console.log('Users.IsActive column ensured');
  } catch (err) {
    console.error('Users schema init error:', err.message);
  }
}

module.exports = initializeUsersSchema;
