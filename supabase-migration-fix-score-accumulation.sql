-- Migration: Fix Score Accumulation in Competition System
-- Issue: Scores are being replaced instead of accumulated
-- Date: 2025-10-02

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS update_competition_score(UUID, UUID, NUMERIC);

-- Create the corrected function that accumulates scores
CREATE OR REPLACE FUNCTION update_competition_score(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
    -- Update participant score by ADDING the new daily score to existing total
    UPDATE competition_participants
    SET
        total_score = COALESCE(total_score, 0) + p_daily_score,  -- ADD to existing score
        days_played = COALESCE(days_played, 0) + 1,               -- INCREMENT days count (FIXED: was days_completed)
        last_played_date = p_date,                                -- Update last played date
        last_score_update = NOW(),                                -- Update timestamp
        updated_at = NOW()
    WHERE
        competition_id = p_competition_id
        AND user_id = p_user_id;

    -- If no row was updated, insert a new participant record
    IF NOT FOUND THEN
        INSERT INTO competition_participants (
            competition_id,
            user_id,
            total_score,
            days_played,
            last_played_date,
            last_score_update,
            created_at,
            updated_at
        ) VALUES (
            p_competition_id,
            p_user_id,
            p_daily_score,
            1,
            p_date,
            NOW(),
            NOW(),
            NOW()
        );
    END IF;

    -- Log the score update for debugging
    RAISE NOTICE 'Score updated: user_id=%, competition_id=%, daily_score=%, new_total=%',
        p_user_id, p_competition_id, p_daily_score,
        (SELECT total_score FROM competition_participants
         WHERE competition_id = p_competition_id AND user_id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_competition_score(UUID, UUID, NUMERIC, DATE) TO authenticated;

-- Also fix the custom competition score submission function
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC);

CREATE OR REPLACE FUNCTION submit_to_custom_competition(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
    -- Update participant score by ADDING the new daily score to existing total
    UPDATE competition_participants
    SET
        total_score = COALESCE(total_score, 0) + p_daily_score,  -- ADD to existing score
        days_played = COALESCE(days_played, 0) + 1,               -- INCREMENT days count (FIXED: was days_completed)
        last_played_date = p_date,                                -- Update last played date
        last_score_update = NOW(),                                -- Update timestamp
        updated_at = NOW()
    WHERE
        competition_id = p_competition_id
        AND user_id = p_user_id;

    -- If no row was updated, insert a new participant record
    IF NOT FOUND THEN
        INSERT INTO competition_participants (
            competition_id,
            user_id,
            total_score,
            days_played,
            last_played_date,
            last_score_update,
            created_at,
            updated_at
        ) VALUES (
            p_competition_id,
            p_user_id,
            p_daily_score,
            1,
            p_date,
            NOW(),
            NOW(),
            NOW()
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION submit_to_custom_competition(UUID, UUID, NUMERIC, DATE) TO authenticated;

-- Verification query (run this after the migration to check)
-- SELECT
--     u.email,
--     cp.total_score,
--     cp.days_completed,
--     cp.updated_at
-- FROM competition_participants cp
-- JOIN auth.users u ON u.id = cp.user_id
-- WHERE cp.competition_id = (SELECT id FROM competitions WHERE is_global = true LIMIT 1)
-- ORDER BY cp.total_score DESC
-- LIMIT 10;

-- Migration complete
-- Next steps:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. Test by submitting a new daily score
-- 3. Verify that total_score increases instead of replacing
