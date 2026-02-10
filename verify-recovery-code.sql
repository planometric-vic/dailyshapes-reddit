-- SQL function to verify recovery code
-- This allows you to check recovery codes directly in Supabase SQL Editor

CREATE OR REPLACE FUNCTION verify_recovery_code(p_username TEXT, p_recovery_code TEXT)
RETURNS TABLE(verified BOOLEAN, username TEXT, message TEXT) AS $$
DECLARE
    v_stored_hash TEXT;
    v_computed_hash TEXT;
BEGIN
    -- Get the stored hash for the username
    SELECT recovery_code INTO v_stored_hash
    FROM users
    WHERE users.username ILIKE p_username;

    -- If user not found
    IF v_stored_hash IS NULL THEN
        RETURN QUERY SELECT FALSE, p_username, 'User not found'::TEXT;
        RETURN;
    END IF;

    -- Compute SHA-256 hash of provided code
    -- Using encode and digest functions available in PostgreSQL
    v_computed_hash := encode(digest(p_recovery_code, 'sha256'), 'hex');

    -- Compare hashes
    IF v_computed_hash = v_stored_hash THEN
        RETURN QUERY SELECT TRUE, p_username, 'Recovery code verified! You can reset the password.'::TEXT;
    ELSE
        RETURN QUERY SELECT FALSE, p_username, 'Recovery code does not match.'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Example usage:
-- SELECT * FROM verify_recovery_code('blinky', '5ZW9-AXU3-L898');
