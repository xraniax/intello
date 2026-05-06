-- Create upload_type enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE upload_type AS ENUM ('PDF', 'ScannedDoc');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create uploads table
CREATE TABLE IF NOT EXISTS uploads (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    type upload_type NOT NULL,
    temp_file_path TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS ix_uploads_user_subject ON uploads(user_id, subject_id);
