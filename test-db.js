import dotenv from 'dotenv';
import { Pool } from 'pg';

// Load environment variables from server/.env
dotenv.config({ path: './server/.env' });

console.log('Testing database connection...');
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('DATABASE_URL (first 50 chars):', process.env.DATABASE_URL?.substring(0, 50) + '...');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true,
});

async function testConnection() {
  try {
    console.log('\n1. Testing basic connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    console.log('\n2. Testing simple query...');
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Query successful:', {
      currentTime: result.rows[0].current_time,
      version: result.rows[0].pg_version.substring(0, 50) + '...'
    });
    
    console.log('\n3. Testing users table...');
    const usersResult = await client.query('SELECT COUNT(*) as user_count FROM users');
    console.log('✅ Users table accessible, count:', usersResult.rows[0].user_count);
    
    console.log('\n4. Testing projects table...');
    const projectsResult = await client.query('SELECT COUNT(*) as project_count FROM projects');
    console.log('✅ Projects table accessible, count:', projectsResult.rows[0].project_count);
    
    console.log('\n5. Testing tasks table...');
    const tasksResult = await client.query('SELECT COUNT(*) as task_count FROM tasks');
    console.log('✅ Tasks table accessible, count:', tasksResult.rows[0].task_count);
    
    client.release();
    console.log('\n🎉 Database is working correctly!');
    
  } catch (error) {
    console.error('\n❌ Database test failed:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.message) {
      console.error('Error message:', error.message);
    }
  } finally {
    await pool.end();
  }
}

testConnection();