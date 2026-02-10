-- Create function to update competition scores
-- This function handles adding daily scores to participants and updating rankings

CREATE OR REPLACE FUNCTION update_competition_score(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score DECIMAL(6,1)
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
        p_daily_score,
        1,
        p_daily_score
    )
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET
        total_score = competition_participants.total_score + p_daily_score,
        days_played = competition_participants.days_played + 1,
        average_score = ROUND((competition_participants.total_score + p_daily_score) / (competition_participants.days_played + 1), 1);

    RAISE NOTICE 'Updated score for user % in competition %: added % (new total: %)',
        p_user_id, p_competition_id, p_daily_score,
        (SELECT total_score FROM competition_participants WHERE competition_id = p_competition_id AND user_id = p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Test the function exists
SELECT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_competition_score'
) as function_exists;
