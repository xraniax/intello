-- migration 07_quota_overhaul.sql
-- Goal: Link files to materials and harden quota tracking

-- 1. Normalize existing user status to uppercase
UPDATE users SET status = UPPER(status);

-- 2. Add material_id to files
ALTER TABLE files ADD COLUMN material_id UUID;

-- 3. Link existing files to materials (best effort)
-- Files were created before materials, so we match by user/subject.
UPDATE files f
SET material_id = m.id
FROM materials m
WHERE f.user_id = m.user_id 
  AND f.subject_id = m.subject_id
  AND f.material_id IS NULL;

-- 4. Add constraints
-- We don't enforce NOT NULL yet to allow migration of old decoupled data if necessary,
-- but all NEW files must have a material_id.
ALTER TABLE files ADD CONSTRAINT files_material_id_fkey FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE;

-- 5. Harden User Status
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
        ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED'));
    END IF;
END $$;

-- 6. Ensure default storage limit (100MB)
UPDATE users SET storage_limit_bytes = 104857600 WHERE storage_limit_bytes IS NULL;
