-- Backfill Competition Scores When Joining
-- This function retroactively adds existing daily scores to a competition
-- when a user joins mid-competition

-- Function to backfill scores for dates the user already completed before joining
CREATE OR REPLACE FUNCTION backfill_competition_scores_on_join(
    p_competition_id UUID,
    p_user_id UUID
)
RETURNS TABLE(
    dates_backfilled INTEGER,
    total_score_added NUMERIC
) AS $$
DECLARE
    v_comp_start_date DATE;
    v_comp_end_date DATE;
    v_dates_count INTEGER := 0;
    v_total_score NUMERIC := 0;
    v_daily_score NUMERIC;
    v_score_date DATE;
BEGIN
    -- Get competition date range
    SELECT start_date, end_date
    INTO v_comp_start_date, v_comp_end_date
    FROM competitions
    WHERE id = p_competition_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Competition not found or inactive: %', p_competition_id;
    END IF;

    -- Find all daily scores for this user within the competition date range
    -- that were completed BEFORE they joined
    -- Calculate daily average from individual attempts
    FOR v_score_date, v_daily_score IN
        SELECT
            ds.date,
            -- Calculate daily average: average of ALL 6 attempts (all cuts)
            -- This matches the calculation in auth-service.js saveDailyScore()
            ROUND(
                (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                 COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                 COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                1
            )::NUMERIC(4,1) as daily_score
        FROM daily_scores ds
        WHERE ds.user_id = p_user_id
          AND ds.date >= v_comp_start_date
          AND ds.date <= v_comp_end_date
          AND ds.completed_at IS NOT NULL  -- Ensure day was actually completed
          AND ds.completed_at <= NOW()  -- Only scores that have been completed (allows future-dated scores)
          -- Exclude dates already counted (in case function is called twice)
          AND NOT EXISTS (
              SELECT 1 FROM competition_daily_tracking cdt
              WHERE cdt.competition_id = p_competition_id
                AND cdt.user_id = p_user_id
                AND cdt.date = ds.date
          )
          -- Only include days where at least one attempt has a score
          AND (ds.shape1_attempt1 IS NOT NULL OR ds.shape1_attempt2 IS NOT NULL OR
               ds.shape2_attempt1 IS NOT NULL OR ds.shape2_attempt2 IS NOT NULL OR
               ds.shape3_attempt1 IS NOT NULL OR ds.shape3_attempt2 IS NOT NULL)
        ORDER BY ds.date ASC
    LOOP
        -- Add this daily score to the competition
        UPDATE competition_participants
        SET
            total_score = COALESCE(total_score, 0) + v_daily_score,
            days_played = COALESCE(days_played, 0) + 1,
            average_score = ROUND((COALESCE(total_score, 0) + v_daily_score) / (COALESCE(days_played, 0) + 1), 1),
            best_day_score = GREATEST(COALESCE(best_day_score, 0), v_daily_score),
            last_played_date = v_score_date,
            last_score_update = NOW()
        WHERE competition_id = p_competition_id
          AND user_id = p_user_id;

        -- Record that we've processed this date (prevents double-counting)
        INSERT INTO competition_daily_tracking (
            competition_id,
            user_id,
            date,
            daily_score,
            created_at
        ) VALUES (
            p_competition_id,
            p_user_id,
            v_score_date,
            v_daily_score,
            NOW()
        )
        ON CONFLICT (competition_id, user_id, date) DO NOTHING;

        -- Track totals for return value
        v_dates_count := v_dates_count + 1;
        v_total_score := v_total_score + v_daily_score;

        RAISE NOTICE 'Backfilled score for date %: % points', v_score_date, v_daily_score;
    END LOOP;

    -- Return summary
    dates_backfilled := v_dates_count;
    total_score_added := v_total_score;

    RETURN NEXT;

    RAISE NOTICE 'Backfill complete: % dates, % total score added', v_dates_count, v_total_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION backfill_competition_scores_on_join(UUID, UUID) TO authenticated;

-- Create tracking table to prevent double-counting
CREATE TABLE IF NOT EXISTS competition_daily_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    daily_score DECIMAL(4,1) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ensure one entry per user per competition per day
    CONSTRAINT unique_competition_user_date UNIQUE(competition_id, user_id, date)
);

-- Create indexes for tracking table
CREATE INDEX IF NOT EXISTS idx_daily_tracking_competition ON competition_daily_tracking(competition_id);
CREATE INDEX IF NOT EXISTS idx_daily_tracking_user ON competition_daily_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_tracking_date ON competition_daily_tracking(date);

-- Enable RLS on tracking table
ALTER TABLE competition_daily_tracking ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists (to allow re-running script)
DROP POLICY IF EXISTS tracking_read_own ON competition_daily_tracking;

-- Allow users to read their own tracking data
CREATE POLICY tracking_read_own ON competition_daily_tracking
    FOR SELECT USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON FUNCTION backfill_competition_scores_on_join IS
'Retroactively adds existing daily scores to a competition when a user joins.
Prevents double-counting by tracking which dates have been processed.
Returns the number of dates backfilled and total score added.';

COMMENT ON TABLE competition_daily_tracking IS
'Tracks which daily scores have been added to competitions to prevent double-counting.
Used when backfilling scores or when users join competitions mid-stream.';
