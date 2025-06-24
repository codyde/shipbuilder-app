import express from 'express';
import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';

export const migrateRoutes = express.Router();

migrateRoutes.post('/init-database', async (req, res) => {
  try {
    console.log('Starting complete database initialization...');
    
    // Step 1: Create enums
    console.log('Creating enums...');
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE task_status AS ENUM ('backlog', 'in_progress', 'completed');
      EXCEPTION WHEN duplicate_object THEN
        null;
      END $$;
    `);
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE project_status AS ENUM ('active', 'backlog', 'completed', 'archived');
      EXCEPTION WHEN duplicate_object THEN
        null;
      END $$;
    `);
    
    await db.execute(sql`
      DO $$ BEGIN
        CREATE TYPE priority AS ENUM ('low', 'medium', 'high');
      EXCEPTION WHEN duplicate_object THEN
        null;
      END $$;
    `);
    
    console.log('Enums created successfully');
    
    // Step 2: Create users table
    console.log('Creating users table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        provider TEXT,
        provider_id TEXT,
        avatar TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    
    // Step 3: Create projects table
    console.log('Creating projects table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS projects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000' REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        status project_status NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    
    // Step 4: Create tasks table
    console.log('Creating tasks table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        details TEXT,
        status task_status NOT NULL DEFAULT 'backlog',
        priority priority NOT NULL DEFAULT 'medium',
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    
    // Step 5: Create comments table
    console.log('Creating comments table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    
    console.log('Database initialization completed successfully!');
    
    // Verify tables exist
    const tablesResult = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    res.json({ 
      success: true, 
      message: 'Database initialized successfully',
      tables: tablesResult.rows.map(row => row.table_name)
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    res.status(500).json({ error: 'Database initialization failed', details: error.message });
  }
});

migrateRoutes.get('/status', async (req, res) => {
  try {
    // Check current enum values
    const enumResult = await db.execute(sql`
      SELECT enumlabel 
      FROM pg_enum 
      WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
      ORDER BY enumsortorder
    `);
    
    // Check current task statuses
    const taskStatusesResult = await db.execute(sql`
      SELECT status, COUNT(*) as count 
      FROM tasks 
      GROUP BY status 
      ORDER BY status
    `);
    
    res.json({
      enumValues: enumResult.rows.map(row => row.enumlabel),
      currentTaskStatuses: taskStatusesResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

migrateRoutes.post('/todo-to-backlog', async (req, res) => {
  try {
    console.log('Starting simplified migration to add backlog and update todo records...');
    
    // Step 1: Add the new 'backlog' value to the existing enum (if it doesn't exist)
    try {
      await db.execute(sql`ALTER TYPE task_status ADD VALUE 'backlog'`);
      console.log('Added backlog value to enum');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('Backlog value already exists in enum');
      } else {
        throw e;
      }
    }
    
    // Step 2: Update all existing 'todo' values to 'backlog'
    const tasksResult = await db.execute(sql`UPDATE tasks SET status = 'backlog' WHERE status = 'todo'`);
    console.log(`Updated ${tasksResult.rowCount} tasks from todo to backlog`);
    
    const subtasksResult = await db.execute(sql`UPDATE subtasks SET status = 'backlog' WHERE status = 'todo'`);
    console.log(`Updated ${subtasksResult.rowCount} subtasks from todo to backlog`);
    
    // Step 3: Update the default values
    await db.execute(sql`ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'backlog'`);
    await db.execute(sql`ALTER TABLE subtasks ALTER COLUMN status SET DEFAULT 'backlog'`);
    console.log('Updated default values to backlog');
    
    console.log('Migration completed successfully!');
    res.json({ 
      success: true, 
      message: 'Migration completed successfully',
      details: {
        tasksUpdated: tasksResult.rowCount,
        subtasksUpdated: subtasksResult.rowCount
      }
    });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

migrateRoutes.post('/add-comments-and-details', async (req, res) => {
  try {
    console.log('Starting migration to add comments table and details field...');
    
    // Step 1: Add details column to tasks table if it doesn't exist
    try {
      await db.execute(sql`ALTER TABLE tasks ADD COLUMN details TEXT`);
      console.log('Added details column to tasks table');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('Details column already exists in tasks table');
      } else {
        throw e;
      }
    }
    
    // Step 2: Create comments table if it doesn't exist
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          author TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        )
      `);
      console.log('Created comments table');
    } catch (e) {
      console.log('Comments table creation failed or already exists:', e.message);
    }
    
    console.log('Migration completed successfully!');
    res.json({ 
      success: true, 
      message: 'Comments and details migration completed successfully'
    });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});

migrateRoutes.post('/remove-subtasks', async (req, res) => {
  try {
    console.log('Starting migration to remove subtasks table...');
    
    // Drop the subtasks table
    try {
      await db.execute(sql`DROP TABLE IF EXISTS subtasks CASCADE`);
      console.log('Dropped subtasks table');
    } catch (e) {
      console.log('Subtasks table drop failed or table does not exist:', e.message);
    }
    
    console.log('Subtasks removal migration completed successfully!');
    res.json({ 
      success: true, 
      message: 'Subtasks removal migration completed successfully'
    });
  } catch (error) {
    console.error('Migration failed:', error);
    res.status(500).json({ error: 'Migration failed', details: error.message });
  }
});