const db = require('./db');

async function initializeSchema() {
  const queries = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(50) DEFAULT '',
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin',
      isActive BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(100),
      status VARCHAR(50) DEFAULT 'active',
      accountApproved BOOLEAN DEFAULT false,
      balance DECIMAL(12,2) DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      userId INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      title VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      isActive BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS faqs (
      id SERIAL PRIMARY KEY,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      isActive BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_us (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      email VARCHAR(255),
      subject VARCHAR(255),
      message TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      description TEXT,
      price DECIMAL(12,2) DEFAULT 0,
      isActive BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_views (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      source VARCHAR(100) DEFAULT 'direct'
    );

    CREATE TABLE IF NOT EXISTS product_metrics (
      id SERIAL PRIMARY KEY,
      product_id INTEGER UNIQUE REFERENCES products(id) ON DELETE CASCADE,
      total_views INTEGER DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      revenue DECIMAL(14,2) DEFAULT 0,
      rating DECIMAL(3,2) DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      quantity INTEGER DEFAULT 1,
      unit_price DECIMAL(12,2) NOT NULL,
      total DECIMAL(14,2) NOT NULL,
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      sold_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS support_requests (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      email VARCHAR(255),
      subject VARCHAR(255),
      message TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) UNIQUE NOT NULL,
      value TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS specializations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      isActive BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS training_modes (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      isActive BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS languages (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      isActive BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trainers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(100),
      specialization VARCHAR(255),
      isActive BOOLEAN DEFAULT true,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      customerId INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      type VARCHAR(50) DEFAULT 'payment',
      amount DECIMAL(12,2) NOT NULL,
      description TEXT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO settings (key, value) VALUES ('privacy-policy', 'Default privacy policy content') ON CONFLICT (key) DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('about-us', 'Default about us content') ON CONFLICT (key) DO NOTHING;
    INSERT INTO settings (key, value) VALUES ('terms-conditions', 'Default terms and conditions content') ON CONFLICT (key) DO NOTHING;

    INSERT INTO users (name, email, password, role) VALUES ('Admin', 'admin@example.com', '$2a$10$dummyhash', 'admin') ON CONFLICT (email) DO NOTHING;
  `;

  const statements = queries.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try {
      await db.query(stmt);
    } catch (err) {
      console.error('Schema init error:', err.message);
    }
  }

  try {
    await db.query(`CREATE SEQUENCE IF NOT EXISTS products_id_seq START WITH 100`);
    await db.query(`ALTER TABLE products ALTER COLUMN id SET DEFAULT nextval('products_id_seq')`);
  } catch (err) {
    console.error('Products sequence init error:', err.message);
  }
  console.log('Database schema initialized');
}

module.exports = initializeSchema;
