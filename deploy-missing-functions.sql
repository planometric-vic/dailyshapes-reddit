-- Missing Competition Functions for Supabase
-- Run this SQL in your Supabase SQL editor to fix the competition leaderboard issue

-- Function to update competition participant score atomically
CREATE OR REPLACE FUNCTION update_competition_score(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score DECIMAL(4,1)
)
RETURNS void AS $$
BEGIN
    -- Upsert participant record with atomic score update
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        total_score,
        days_played,
        best_day_score,
        average_score
    )
    VALUES (
        p_competition_id,
        p_user_id,
        p_daily_score,
        1,
        p_daily_score,
        p_daily_score
    )
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET
        total_score = competition_participants.total_score + p_daily_score,
        days_played = competition_participants.days_played + 1,
        best_day_score = GREATEST(competition_participants.best_day_score, p_daily_score),
        average_score = ROUND((competition_participants.total_score + p_daily_score) / (competition_participants.days_played + 1), 1);
        
    -- Update competition rankings
    PERFORM update_competition_rankings(p_competition_id);
END;
$$ LANGUAGE plpgsql;

-- Add the best_day_score column if it doesn't exist
ALTER TABLE competition_participants 
ADD COLUMN IF NOT EXISTS best_day_score DECIMAL(4,1) DEFAULT 0;

-- Create index for the new column if needed
CREATE INDEX IF NOT EXISTS idx_competition_participants_best_score 
ON competition_participants(competition_id, best_day_score DESC);

-- Add rank column if it doesn't exist (used by the rankings function)
ALTER TABLE competition_participants 
ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 999999;

-- Create index for rank column
CREATE INDEX IF NOT EXISTS idx_competition_participants_rank 
ON competition_participants(competition_id, rank);

-- Update the rankings function to use the rank column
CREATE OR REPLACE FUNCTION update_competition_rankings(p_competition_id UUID)
RETURNS void AS $$
BEGIN
    WITH ranked_participants AS (
        SELECT 
            id,
            RANK() OVER (ORDER BY total_score DESC, days_played DESC) as new_rank
        FROM competition_participants
        WHERE competition_id = p_competition_id
    )
    UPDATE competition_participants cp
    SET rank = rp.new_rank
    FROM ranked_participants rp
    WHERE cp.id = rp.id;
END;
$$ LANGUAGE plpgsql;

-- Test the function exists
SELECT EXISTS (
    SELECT 1 
    FROM pg_proc 
    WHERE proname = 'update_competition_score'
) as function_exists;