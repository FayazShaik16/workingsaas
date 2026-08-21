-- Migration: Ensure priority_level enum and tasks.priority column are present
DO $$ BEGIN
    CREATE TYPE priority_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add priority column to tasks table if it does not already exist
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority priority_level NOT NULL DEFAULT 'MEDIUM';

-- Create an index on priority for fast filtering
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority);
