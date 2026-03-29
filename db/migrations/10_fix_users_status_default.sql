-- Fix: users.status column default was lowercase 'active' but the CHECK constraint
-- only allows uppercase values ('ACTIVE', 'SUSPENDED', 'DELETED').
-- New registrations were failing because the INSERT omits the status column,
-- causing Postgres to use the old lowercase default which violates the constraint.

ALTER TABLE users ALTER COLUMN status SET DEFAULT 'ACTIVE';
