const devDb = require('./services/dev-db');

const platforms = [
  { id: 1, title: 'Instagram', status: 'A' },
  { id: 2, title: 'Facebook', status: 'A' },
  { id: 3, title: 'TikTok', status: 'A' },
  { id: 4, title: 'YouTube', status: 'A' },
  { id: 5, title: 'Twitter / X', status: 'A' },
  { id: 6, title: 'LinkedIn', status: 'A' },
  { id: 7, title: 'Snapchat', status: 'A' },
  { id: 8, title: 'Pinterest', status: 'I' },
  { id: 9, title: 'Google Business', status: 'A' },
  { id: 10, title: 'Email Newsletter', status: 'A' },
  { id: 11, title: 'WhatsApp Business', status: 'A' },
  { id: 12, title: 'Shopify', status: 'A' },
];

async function seedPlatforms() {
  try {
    // Ensure PLA_TITLE column is wide enough for real platform names
    await devDb.query(`ALTER TABLE PLATFORM ALTER COLUMN PLA_TITLE NVARCHAR(40) NOT NULL`);
    console.log('Ensured PLA_TITLE column is NVARCHAR(40)');

    for (const p of platforms) {
      const existing = await devDb.query(
        `SELECT PLA_ID FROM PLATFORM WHERE PLA_ID = @p1`,
        [p.id]
      );

      if (existing.rows.length === 0) {
        await devDb.query(
          `INSERT INTO PLATFORM (PLA_ID, PLA_TITLE, PLA_AVAILABLE, PLA_STATUS, PLA_DATE_INSERTED, PLA_DATE_UPDATED)
           VALUES (@p1, @p2, @p3, @p4, GETDATE(), GETDATE())`,
          [p.id, p.title, p.status === 'A' ? 'Y' : 'N', p.status]
        );
        console.log(`Created platform: ${p.title} (ID ${p.id})`);
      } else {
        await devDb.query(
          `UPDATE PLATFORM SET PLA_TITLE = @p2, PLA_STATUS = @p3 WHERE PLA_ID = @p1`,
          [p.id, p.title, p.status]
        );
        console.log(`Updated platform: ${p.title} (ID ${p.id})`);
      }
    }

    const count = await devDb.query(`SELECT COUNT(*) AS cnt FROM PLATFORM`);
    console.log(`Platform seed complete. Total platforms: ${count.rows[0].cnt}`);

    const { syncSequence } = require('./services/sequences-schema');
    await syncSequence({ sequence: 'PLA_SEQ', table: 'PLATFORM', column: 'PLA_ID' });
    console.log('PLA_SEQ resynced after seed');

    process.exit(0);
  } catch (err) {
    console.error('Platform seed error:', err);
    process.exit(1);
  }
}

seedPlatforms();
