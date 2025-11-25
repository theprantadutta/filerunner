-- Add must_change_password column to users table
-- Only admin users created on startup will have this set to TRUE
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
