-- 06_harden_job_lifecycle.sql
-- Adds fields for robust job tracking and observability

-- Create status enum if it doesn't exist (assuming PostgreSQL)
DO $$ BEGIN
    CREATE TYPE material_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to materials table
ALTER TABLE materials 
ADD COLUMN IF NOT EXISTS status material_status DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS error_message TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Initialize existing records
UPDATE materials SET status = 'COMPLETED' WHERE status IS NULL OR status = 'PENDING';
