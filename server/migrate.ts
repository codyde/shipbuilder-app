import dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { Pool } from 'pg';
import { readFileSync } from 'fs';

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
  });

  try {
    console.log('Starting authentication migration...');
    
    // Read the migration file
    const migration = readFileSync('./drizzle/0002_auth_fix.sql', 'utf8');
    
    // Execute the migration
    await pool.query(migration);
    
    console.log('Authentication migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();