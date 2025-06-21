-- Migration to change 'todo' to 'backlog' in task_status enum
-- This is a complex operation in PostgreSQL that requires careful steps

BEGIN;

-- Step 1: Add the new 'backlog' value to the existing enum
ALTER TYPE task_status ADD VALUE 'backlog';

-- Step 2: Update all existing 'todo' values to 'backlog'
UPDATE tasks SET status = 'backlog' WHERE status = 'todo';
UPDATE subtasks SET status = 'backlog' WHERE status = 'todo';

-- Step 3: Create a new enum without 'todo'
CREATE TYPE task_status_new AS ENUM ('backlog', 'in_progress', 'completed');

-- Step 4: Update tables to use the new enum
ALTER TABLE tasks ALTER COLUMN status TYPE task_status_new USING status::text::task_status_new;
ALTER TABLE subtasks ALTER COLUMN status TYPE task_status_new USING status::text::task_status_new;

-- Step 5: Drop the old enum and rename the new one
DROP TYPE task_status;
ALTER TYPE task_status_new RENAME TO task_status;

-- Step 6: Update the default values
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'backlog';
ALTER TABLE subtasks ALTER COLUMN status SET DEFAULT 'backlog';

COMMIT;