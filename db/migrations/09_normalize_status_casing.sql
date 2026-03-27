-- Normalize all material statuses to uppercase for consistency
UPDATE materials SET status = UPPER(status) WHERE status != UPPER(status);

-- Also ensure CHECK constraint on users status (already exists, but just in case)
UPDATE users SET status = UPPER(status) WHERE status != UPPER(status);
