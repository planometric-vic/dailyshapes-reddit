-- ============================================================================
-- FIXED: update_competition_score
-- Prevents duplicate score submissions for the same date
-- ============================================================================

CREATE OR REPLACE FUNCTION update_competition_score(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    new_total_score NUMERIC,
    new_days_played INTEGER
) AS $$
DECLARE
    v_existing_score NUMERIC;
    v_new_total NUMERIC;
    v_new_days INTEGER;
BEGIN
    -- Check if a score already exists for this date
    SELECT daily_score INTO v_existing_score
    FROM competition_daily_tracking
    WHERE competition_id = p_competition_id
      AND user_id = p_user_id
      AND date = p_date;

    IF v_existing_score IS NOT NULL THEN
        -- Score already exists for this date - UPDATE it
        RAISE NOTICE 'Score already exists for date %. Updating from % to %',
            p_date, v_existing_score, p_daily_score;

        UPDATE competition_daily_tracking
        SET daily_score = p_daily_score,
            created_at = NOW()
        WHERE competition_id = p_competition_id
          AND user_id = p_user_id
          AND date = p_date;
    ELSE
        -- New date - INSERT new daily score
        RAISE NOTICE 'New score for date %. Inserting %', p_date, p_daily_score;

        INSERT INTO competition_daily_tracking (
            competition_id,
            user_id,
            date,
            daily_score,
            created_at
        ) VALUES (
            p_competition_id,
            p_user_id,
            p_date,
            p_daily_score,
            NOW()
        );
    END IF;

    -- Recalculate totals from ALL daily scores (single source of truth)
    SELECT
        COALESCE(SUM(daily_score), 0),
        COUNT(*)
    INTO v_new_total, v_new_days
    FROM competition_daily_tracking
    WHERE competition_id = p_competition_id
      AND user_id = p_user_id;

    -- Update participant record with recalculated totals
    UPDATE competition_participants
    SET
        total_score = v_new_total,
        days_played = v_new_days,
        average_score = ROUND(v_new_total / NULLIF(v_new_days, 0), 1),
        last_played_date = p_date,
        last_score_update = NOW(),
        best_day_score = GREATEST(COALESCE(best_day_score, 0), p_daily_score)
    WHERE competition_id = p_competition_id
      AND user_id = p_user_id;

    -- Return success info
    success := TRUE;
    message := CASE
        WHEN v_existing_score IS NOT NULL THEN 'Updated existing score'
        ELSE 'Added new daily score'
    END;
    new_total_score := v_new_total;
    new_days_played := v_new_days;

    RETURN NEXT;

    RAISE NOTICE 'Final totals - Score: %, Days: %', v_new_total, v_new_days;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- FIXED: backfill_competition_scores_on_join
-- Already has proper duplicate prevention via competition_daily_tracking
-- This function is actually CORRECT - it checks for existing records
-- ============================================================================
-- No changes needed - the backfill function already has proper duplicate
-- detection via the NOT EXISTS clause and ON CONFLICT DO NOTHING
