const { Pool } = require('pg');
require('dotenv').config();

const isSupabase =
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes('supabase.com') ||
    process.env.DATABASE_URL.includes('supabase.co'));

const useSSL =
  process.env.NODE_ENV === 'production' ||
  process.env.DB_SSL === 'true' ||
  Boolean(isSupabase);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connection established.');
  } finally {
    client.release();
  }
}

module.exports = { pool, testConnection };
