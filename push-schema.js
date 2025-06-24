import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

console.log('🚀 Pushing schema to new database...');
console.log('Database URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});

const db = drizzle(pool);

async function pushSchema() {
  try {
    console.log('📋 Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Schema pushed successfully!');
    
    // Verify tables exist
    console.log('🔍 Verifying tables...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Tables created:');
    result.rows.forEach(row => console.log(`  - ${row.table_name}`));
    
  } catch (error) {
    console.error('❌ Failed to push schema:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

pushSchema();