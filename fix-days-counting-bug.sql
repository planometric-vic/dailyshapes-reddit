-- Fix for the days counting bug
-- This ensures we only increment days_played once per actual day

-- First, let's create a helper table to track daily plays if it doesn't exist
CREATE TABLE IF NOT EXISTS competition_daily_plays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    play_date DATE NOT NULL,
    daily_score DECIMAL(4,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(competition_id, user_id, play_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_competition_daily_plays 
ON competition_daily_plays(competition_id, user_id, play_date);

-- Updated function that properly tracks days
CREATE OR REPLACE FUNCTION update_competition_score(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score DECIMAL(4,1)
)
RETURNS void AS $$
DECLARE
    v_already_played BOOLEAN;
    v_current_date DATE;
    v_days_played INTEGER;
    v_total_score DECIMAL(10,2);
BEGIN
    -- Get the current date
    v_current_date := CURRENT_DATE;
    
    -- Check if user has already played today for this competition
    SELECT EXISTS (
        SELECT 1 FROM competition_daily_plays
        WHERE competition_id = p_competition_id
        AND user_id = p_user_id
        AND play_date = v_current_date
    ) INTO v_already_played;
    
    IF v_already_played THEN
        -- User already played today, just update the score for today
        UPDATE competition_daily_plays
        SET daily_score = p_daily_score
        WHERE competition_id = p_competition_id
        AND user_id = p_user_id
        AND play_date = v_current_date;
        
        -- Recalculate total score and days from the daily plays table
        SELECT 
            COUNT(DISTINCT play_date),
            COALESCE(SUM(daily_score), 0)
        INTO v_days_played, v_total_score
        FROM competition_daily_plays
        WHERE competition_id = p_competition_id
        AND user_id = p_user_id;
        
        -- Update the participant record with recalculated values
        UPDATE competition_participants
        SET 
            total_score = v_total_score,
            days_played = v_days_played,
            average_score = ROUND(v_total_score / v_days_played, 1),
            best_day_score = (
                SELECT MAX(daily_score) 
                FROM competition_daily_plays 
                WHERE competition_id = p_competition_id 
                AND user_id = p_user_id
            )
        WHERE competition_id = p_competition_id
        AND user_id = p_user_id;
    ELSE
        -- First play of the day, record it
        INSERT INTO competition_daily_plays (
            competition_id,
            user_id,
            play_date,
            daily_score
        ) VALUES (
            p_competition_id,
            p_user_id,
            v_current_date,
            p_daily_score
        );
        
        -- Now update or insert the participant record
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
    END IF;
    
    -- Update competition rankings
    PERFORM update_competition_rankings(p_competition_id);
END;
$$ LANGUAGE plpgsql;

-- Fix existing incorrect data by recalculating from daily_scores table
-- This will correct the days_played count for all participants
DO $$
DECLARE
    participant_record RECORD;
    correct_days INTEGER;
    correct_total DECIMAL(10,2);
BEGIN
    FOR participant_record IN 
        SELECT DISTINCT cp.competition_id, cp.user_id
        FROM competition_participants cp
        WHERE cp.days_played > 0
    LOOP
        -- Count actual distinct days played from daily_scores
        SELECT 
            COUNT(DISTINCT ds.date),
            COALESCE(SUM(
                CASE 
                    WHEN ds.shape1_attempt2 IS NOT NULL THEN 
                        (GREATEST(ds.shape1_attempt1, ds.shape1_attempt2) + 
                         GREATEST(ds.shape2_attempt1, ds.shape2_attempt2) + 
                         GREATEST(ds.shape3_attempt1, ds.shape3_attempt2)) / 3.0
                    ELSE 
                        (ds.shape1_attempt1 + ds.shape2_attempt1 + ds.shape3_attempt1) / 3.0
                END
            ), 0)
        INTO correct_days, correct_total
        FROM daily_scores ds
        JOIN competitions c ON c.id = participant_record.competition_id
        WHERE ds.user_id = participant_record.user_id
        AND ds.date >= c.start_date
        AND ds.date <= c.end_date
        AND participant_record.competition_id = ANY(ds.competitions_participated);
        
        -- Update with correct values
        IF correct_days > 0 THEN
            UPDATE competition_participants
            SET 
                days_played = correct_days,
                total_score = correct_total,
                average_score = ROUND(correct_total / correct_days, 1)
            WHERE competition_id = participant_record.competition_id
            AND user_id = participant_record.user_id;
        END IF;
    END LOOP;
END $$;

-- Show the corrected data
SELECT 
    u.username,
    cp.days_played,
    cp.total_score,
    cp.average_score,
    c.name as competition_name
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
WHERE cp.days_played > 0
ORDER BY c.name, cp.total_score DESC;