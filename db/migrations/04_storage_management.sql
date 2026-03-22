-- 04_storage_management.sql

-- 1. Admin Settings Table for global limits
CREATE TABLE IF NOT EXISTS admin_settings (
    key VARCHAR(50) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed default settings
INSERT INTO admin_settings (key, value) VALUES 
('storage_controls', '{
    "max_file_size_mb": 10,
    "allowed_types": ["application/pdf"],
    "default_user_quota_mb": 100
}') 
ON CONFLICT (key) DO NOTHING;

-- 2. Files Table for persistent tracking of original uploads
CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Add storage limit override to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_limit_bytes BIGINT;

-- 4. Add index for file management performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_subject_id ON files(subject_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at);
