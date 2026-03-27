-- Add job_id column to materials table for Celery task tracking
ALTER TABLE materials ADD COLUMN IF NOT EXISTS job_id VARCHAR(255);
