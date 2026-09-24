-- A second, read-only key per project. It can download files (including private ones) but
-- can't upload or delete, so it is safe to put in links and app front-ends.
-- The volatile default gives every existing project its own random key.
ALTER TABLE projects ADD COLUMN read_key UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE projects ADD CONSTRAINT projects_read_key_unique UNIQUE (read_key);
