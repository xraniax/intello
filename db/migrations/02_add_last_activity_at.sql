-- Migration to add last_activity_at to subjects table for Cognify

-- 1. Add the column
ALTER TABLE subjects ADD COLUMN last_activity_at TIMESTAMP DEFAULT NOW();

-- 2. Initialize it with existing updated_at or created_at for legacy data
UPDATE subjects SET last_activity_at = COALESCE(updated_at, created_at, NOW());

-- 3. Add an index for performance as we will frequently filter/sort by this column
CREATE INDEX IF NOT EXISTS idx_subjects_last_activity_at ON subjects(last_activity_at);
