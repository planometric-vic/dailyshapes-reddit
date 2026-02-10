-- Migration: Make username uniqueness case-insensitive
-- This prevents users from registering usernames that differ only by case
-- e.g., "BennyK" and "bennyk" cannot both exist

-- Step 1: Create a unique index on LOWER(username)
-- This enforces case-insensitive uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- Note: The existing UNIQUE constraint on username can remain as it doesn't hurt,
-- but the new index on LOWER(username) will be the one that enforces case-insensitive uniqueness

-- Step 2: Verify the constraint works
-- After running this migration, test by trying to create:
-- INSERT INTO users (email, username, password_hash) VALUES ('test1@example.com', 'TestUser', 'hash');
-- INSERT INTO users (email, username, password_hash) VALUES ('test2@example.com', 'testuser', 'hash');
-- The second insert should fail with a duplicate key error

-- Migration complete
-- Now usernames are case-insensitive unique
