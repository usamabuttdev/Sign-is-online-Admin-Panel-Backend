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

    console.log('Seed complete');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
