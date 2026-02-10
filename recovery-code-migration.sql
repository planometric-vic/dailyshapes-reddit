-- Recovery Code Migration
-- Add recovery_code field to users table for password reset verification

-- Add recovery_code column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS recovery_code VARCHAR(20);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_recovery_code
ON users(recovery_code);

-- Add comment explaining the field
COMMENT ON COLUMN users.recovery_code IS 'Hashed recovery code for password reset verification. Format: XXXX-XXXX-XXXX';
