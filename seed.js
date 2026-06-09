const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  try {
    await require('./schema')();

    const existing = await db.query('SELECT id FROM users WHERE email = $1', ['admin@example.com']);
    if (existing.rows.length === 0) {
      const hashed = await bcrypt.hash('admin123', 10);
      await db.query('INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)', ['Admin', 'admin@example.com', hashed, 'admin']);
      console.log('Admin user created: admin@example.com / admin123');
    } else {
      const hashed = await bcrypt.hash('admin123', 10);
      await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashed, 'admin@example.com']);
      console.log('Admin password reset: admin@example.com / admin123');
    }

    const existingProducts = await db.query('SELECT COUNT(*)::int AS count FROM products');
    if (existingProducts.rows[0].count < 5) {
      await db.query(`INSERT INTO products (name, description, price) VALUES
        ('Wireless Mouse', 'Ergonomic wireless mouse with Bluetooth', 29.99),
        ('Mechanical Keyboard', 'RGB mechanical keyboard with Cherry MX switches', 89.99),
        ('USB-C Hub', '7-in-1 USB-C hub with HDMI, SD card, and USB 3.0', 34.99),
        ('Laptop Stand', 'Adjustable aluminum laptop stand', 24.99),
        ('Noise Cancelling Headphones', 'Over-ear wireless headphones with ANC', 149.99)
      ON CONFLICT DO NOTHING`);
      console.log('Added 5 products');
    } else {
      console.log(`${existingProducts.rows[0].count} products already exist, skipping product seed`);
    }

    const prodRows = await db.query('SELECT id FROM products ORDER BY id');
    const productIds = prodRows.rows.map(r => r.id);

    if (productIds.length > 0) {
      const viewCount = await db.query('SELECT COUNT(*)::int AS count FROM product_views');
      if (viewCount.rows[0].count < 20) {
        const sources = ['direct', 'search', 'social', 'email', 'referral'];
        const values = [];
        for (let i = 0; i < 30; i++) {
          const pid = productIds[Math.floor(Math.random() * productIds.length)];
          const source = sources[Math.floor(Math.random() * sources.length)];
          const daysAgo = Math.floor(Math.random() * 90);
          const ts = new Date(Date.now() - daysAgo * 86400000).toISOString();
          values.push(`(${pid}, NULL, '${ts}', '${source}')`);
        }
        await db.query(`INSERT INTO product_views (product_id, user_id, viewed_at, source) VALUES ${values.join(',')}`);
        console.log(`Inserted ${values.length} product views`);
      } else {
        console.log(`${viewCount.rows[0].count} product views already exist, skipping`);
      }

      const metricCount = await db.query('SELECT COUNT(*)::int AS count FROM product_metrics');
      if (metricCount.rows[0].count < productIds.length) {
        const mValues = productIds.map(pid => {
          const views = Math.floor(Math.random() * 5000);
          const sales = Math.floor(Math.random() * 200);
          const revenue = (sales * (Math.random() * 100 + 10)).toFixed(2);
          const rating = (Math.random() * 2 + 3).toFixed(2);
          return `(${pid}, ${views}, ${sales}, ${revenue}, ${rating})`;
        });
        await db.query(`INSERT INTO product_metrics (product_id, total_views, total_sales, revenue, rating) VALUES ${mValues.join(',')} ON CONFLICT (product_id) DO NOTHING`);
        console.log(`Inserted ${mValues.length} product metric rows`);
      } else {
        console.log('Product metrics already exist, skipping');
      }

      const saleCount = await db.query('SELECT COUNT(*)::int AS count FROM sales');
      if (saleCount.rows[0].count < 20) {
        const existingCustomers = await db.query('SELECT id FROM customers ORDER BY id');
        const customerIds = existingCustomers.rows.map(r => r.id);
        const sValues = [];
        for (let i = 0; i < 25; i++) {
          const pid = productIds[Math.floor(Math.random() * productIds.length)];
          const qty = Math.floor(Math.random() * 5) + 1;
          const up = parseFloat((Math.random() * 100 + 10).toFixed(2));
          const total = parseFloat((qty * up).toFixed(2));
          const cid = customerIds.length > 0 ? customerIds[Math.floor(Math.random() * customerIds.length)] : 'NULL';
          const daysAgo = Math.floor(Math.random() * 60);
          const ts = new Date(Date.now() - daysAgo * 86400000).toISOString();
          sValues.push(`(${pid}, ${qty}, ${up}, ${total}, ${cid}, '${ts}')`);
        }
        await db.query(`INSERT INTO sales (product_id, quantity, unit_price, total, customer_id, sold_at) VALUES ${sValues.join(',')}`);
        console.log(`Inserted ${sValues.length} sales`);
      } else {
        console.log('Sales already exist, skipping');
      }
    }

    console.log('Seed complete');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
