const devDb = require('./services/dev-db');

const products = [
  { id: 1, title: 'Basic Membership', sub: 'Monthly', status: 'A' },
  { id: 2, title: 'Premium Membership', sub: 'Monthly', status: 'A' },
  { id: 3, title: 'Annual Plan', sub: 'Yearly', status: 'A' },
  { id: 4, title: 'Lifetime Access', sub: 'Lifetime', status: 'A' },
  { id: 5, title: 'Starter Kit', sub: 'One-time', status: 'A' },
  { id: 6, title: 'Pro Bundle', sub: 'Quarterly', status: 'A' },
  { id: 7, title: 'Enterprise Suite', sub: 'Yearly', status: 'A' },
  { id: 8, title: 'Free Trial', sub: 'Monthly', status: 'I' },
  { id: 9, title: 'Workshop Pass', sub: 'One-time', status: 'A' },
  { id: 10, title: 'Mentorship Program', sub: 'Monthly', status: 'A' },
];

async function seedProducts() {
  try {
    await devDb.query(`ALTER TABLE PRODUCT ALTER COLUMN PRO_TITLE NVARCHAR(40) NOT NULL`);
    await devDb.query(`ALTER TABLE PRODUCT ALTER COLUMN PRO_SUBSCRIPTION_LENGTH NVARCHAR(20) NOT NULL`);
    console.log('Ensured columns are wide enough');

    for (const p of products) {
      const existing = await devDb.query(`SELECT PRO_ID FROM PRODUCT WHERE PRO_ID = @p1`, [p.id]);
      if (existing.rows.length === 0) {
        await devDb.query(
          `INSERT INTO PRODUCT (PRO_ID, PRO_TITLE, PRO_SUBSCRIPTION_LENGTH, PRO_STATUS, PRO_DATE_INSERTED, PRO_DATE_UPDATED)
           VALUES (@p1, @p2, @p3, @p4, GETDATE(), GETDATE())`,
          [p.id, p.title, p.sub, p.status]
        );
        console.log(`Created product: ${p.title} (ID ${p.id})`);
      } else {
        await devDb.query(
          `UPDATE PRODUCT SET PRO_TITLE = @p2, PRO_SUBSCRIPTION_LENGTH = @p3, PRO_STATUS = @p4 WHERE PRO_ID = @p1`,
          [p.id, p.title, p.sub, p.status]
        );
        console.log(`Updated product: ${p.title} (ID ${p.id})`);
      }
    }

    const count = await devDb.query(`SELECT COUNT(*) AS cnt FROM PRODUCT`);
    console.log(`Product seed complete. Total products: ${count.rows[0].cnt}`);
    process.exit(0);
  } catch (err) {
    console.error('Product seed error:', err);
    process.exit(1);
  }
}

seedProducts();
