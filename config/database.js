const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log(
    `✅ Database connected successfully (${isProduction ? 'SSL' : 'NO SSL'})`
  );
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(1);
});

module.exports = pool;
