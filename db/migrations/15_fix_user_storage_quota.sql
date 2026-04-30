-- migration 15_fix_user_storage_quota.sql
-- Goal: Make user storage limits dynamic by treating the default user limit as NULL.

-- 1. Drop the hard-coded default value from the column
ALTER TABLE users ALTER COLUMN storage_limit_bytes DROP DEFAULT;

-- 2. Drop the NOT NULL constraint to allow dynamic inheritance of Platform default
ALTER TABLE users ALTER COLUMN storage_limit_bytes DROP NOT NULL;

-- 3. Retroactively clear the hardcoded 100MB marker from standard users 
-- so they dynamically follow whatever the admin configures in SettingsService
UPDATE users SET storage_limit_bytes = NULL WHERE storage_limit_bytes = 104857600;
