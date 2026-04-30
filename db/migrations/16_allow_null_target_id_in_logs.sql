-- migration 16_allow_null_target_id_in_logs.sql
-- Goal: Allow admin_logs.target_id to be NULL for system-level actions
-- (e.g. UPDATE_SETTINGS, STORAGE_CLEANUP) which have no specific entity target.

ALTER TABLE admin_logs ALTER COLUMN target_id DROP NOT NULL;
