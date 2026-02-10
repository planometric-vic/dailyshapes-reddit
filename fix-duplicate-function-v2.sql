-- Fix duplicate update_competition_score function (Version 2)
-- Drop BOTH the 3-parameter and 4-parameter versions

-- Step 1: Drop both versions explicitly
DROP FUNCTION IF EXISTS update_competition_score(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS update_competition_score(UUID, UUID, NUMERIC, DATE);

-- Step 2: Create only the 3-parameter version (we don't need the date parameter)
CREATE OR REPLACE FUNCTION update_competition_score(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score NUMERIC
)
RETURNS void AS $$
BEGIN
    -- Upsert participant record with atomic score update
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        total_score,
        days_played,
        average_score
    )
    VALUES (
        p_competition_id,
        p_user_id,
        p_daily_score::DECIMAL(10,1),
        1,
        p_daily_score::DECIMAL(10,1)
    )
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET
        total_score = competition_participants.total_score + EXCLUDED.total_score,
        days_played = competition_participants.days_played + 1,
        average_score = ROUND((competition_participants.total_score + EXCLUDED.total_score) / (competition_participants.days_played + 1), 1);

    RAISE NOTICE 'Updated score for user % in competition %: added % (new total: %)',
        p_user_id, p_competition_id, p_daily_score,
        (SELECT total_score FROM competition_participants WHERE competition_id = p_competition_id AND user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Step 3: Verify only ONE version exists now
SELECT
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments,
    pronargs as num_args
FROM pg_proc
WHERE proname = 'update_competition_score';

-- Should return exactly 1 row with 3 parameters
