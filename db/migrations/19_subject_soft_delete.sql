ALTER TABLE subjects
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_subjects_deleted_at ON subjects(deleted_at);
