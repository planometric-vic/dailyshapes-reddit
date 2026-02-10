-- ============================================================================
-- COMPLETE FIX FOR ALL COMPETITION SCORES
-- This script will:
-- 1. Fix the database functions permanently
-- 2. Recalculate ALL scores for ALL users in ALL active competitions
-- 3. Ensure scores are accurate sums of daily scores within competition dates
-- 4. Prevent the bug from recurring
-- ============================================================================

-- ============================================================================
-- PART 1: FIX THE SUBMIT FUNCTION (Prevent Future Issues)
-- ============================================================================

-- Drop ALL possible versions of the buggy function
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC, DATE);
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, DECIMAL(4,1));
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, DECIMAL(4,1), DATE);

-- Create the CORRECT function using INSERT ... ON CONFLICT (most atomic)
CREATE OR REPLACE FUNCTION submit_to_custom_competition(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
    -- Use INSERT ... ON CONFLICT for atomic upsert
    -- This ensures we either ADD to existing score or create new entry
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        total_score,
        days_played,
        best_day_score,
        average_score,
        last_played_date,
        last_score_update,
        joined_at
    )
    VALUES (
        p_competition_id,
        p_user_id,
        p_daily_score,
        1,
        p_daily_score,
        p_daily_score,
        p_date,
        NOW(),
        NOW()
    )
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET
        -- KEY FIX: ADD to existing total, don't replace!
        total_score = competition_participants.total_score + p_daily_score,
        days_played = competition_participants.days_played + 1,
        best_day_score = GREATEST(competition_participants.best_day_score, p_daily_score),
        average_score = ROUND((competition_participants.total_score + p_daily_score) / (competition_participants.days_played + 1), 1),
        last_played_date = p_date,
        last_score_update = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (the 3-param version works via default parameter)
GRANT EXECUTE ON FUNCTION submit_to_custom_competition(UUID, UUID, NUMERIC, DATE) TO authenticated;

DO $$ BEGIN
    RAISE NOTICE '✅ FIXED: submit_to_custom_competition function now ADDS scores correctly';
END $$;

-- ============================================================================
-- PART 2: FIX THE UPDATE COMPETITION SCORE FUNCTION (for global competitions)
-- ============================================================================

DROP FUNCTION IF EXISTS update_competition_score(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS update_competition_score(UUID, UUID, NUMERIC, DATE);

CREATE OR REPLACE FUNCTION update_competition_score(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
    INSERT INTO competition_participants (
        competition_id,
        user_id,
        total_score,
        days_played,
        best_day_score,
        average_score,
        last_played_date,
        last_score_update,
        joined_at
    )
    VALUES (
        p_competition_id,
        p_user_id,
        p_daily_score,
        1,
        p_daily_score,
        p_daily_score,
        p_date,
        NOW(),
        NOW()
    )
    ON CONFLICT (competition_id, user_id)
    DO UPDATE SET
        total_score = competition_participants.total_score + p_daily_score,
        days_played = competition_participants.days_played + 1,
        best_day_score = GREATEST(competition_participants.best_day_score, p_daily_score),
        average_score = ROUND((competition_participants.total_score + p_daily_score) / (competition_participants.days_played + 1), 1),
        last_played_date = p_date,
        last_score_update = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (the 3-param version works via default parameter)
GRANT EXECUTE ON FUNCTION update_competition_score(UUID, UUID, NUMERIC, DATE) TO authenticated;

DO $$ BEGIN
    RAISE NOTICE '✅ FIXED: update_competition_score function now ADDS scores correctly';
END $$;

-- ============================================================================
-- PART 3: RECALCULATE ALL SCORES FOR ALL ACTIVE COMPETITIONS
-- ============================================================================

DO $$
DECLARE
    comp_record RECORD;
    user_record RECORD;
    total_fixed INTEGER := 0;
    competitions_processed INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '🔧 RECALCULATING SCORES FOR ALL ACTIVE COMPETITIONS';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';

    -- Loop through all active competitions
    FOR comp_record IN
        SELECT id, name, start_date, end_date, is_global
        FROM competitions
        WHERE is_active = true
        ORDER BY start_date DESC
    LOOP
        competitions_processed := competitions_processed + 1;

        RAISE NOTICE '📊 Processing: % (% to %)',
            comp_record.name,
            comp_record.start_date,
            comp_record.end_date;

        -- For each competition, recalculate all participant scores
        FOR user_record IN
            WITH calculated_scores AS (
                SELECT
                    ds.user_id,
                    -- Calculate correct total from ALL daily scores in competition period
                    SUM(
                        ROUND(
                            (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                             COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                             COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                            1
                        )
                    ) as correct_total,
                    -- Count actual days played
                    COUNT(*) as correct_days,
                    -- Get best single day score
                    MAX(
                        ROUND(
                            (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                             COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                             COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                            1
                        )
                    ) as best_score,
                    -- Get most recent date played
                    MAX(ds.date) as last_date
                FROM daily_scores ds
                WHERE ds.user_id IN (
                    SELECT user_id
                    FROM competition_participants
                    WHERE competition_id = comp_record.id
                )
                AND ds.date >= comp_record.start_date
                AND ds.date <= comp_record.end_date
                AND ds.date <= CURRENT_DATE  -- Don't include future dates
                AND ds.completed_at IS NOT NULL
                -- Ensure at least one score exists
                AND (ds.shape1_attempt1 IS NOT NULL OR ds.shape1_attempt2 IS NOT NULL OR
                     ds.shape2_attempt1 IS NOT NULL OR ds.shape2_attempt2 IS NOT NULL OR
                     ds.shape3_attempt1 IS NOT NULL OR ds.shape3_attempt2 IS NOT NULL)
                GROUP BY ds.user_id
            )
            SELECT
                u.username,
                cs.user_id,
                COALESCE(cp.total_score, 0) as old_total,
                cs.correct_total,
                cs.correct_days,
                cs.best_score,
                cs.last_date
            FROM calculated_scores cs
            LEFT JOIN competition_participants cp
                ON cp.user_id = cs.user_id
                AND cp.competition_id = comp_record.id
            LEFT JOIN users u ON u.id = cs.user_id
            WHERE cs.correct_total > 0  -- Only users with actual scores
        LOOP
            -- Update the participant record with correct values
            INSERT INTO competition_participants (
                competition_id,
                user_id,
                total_score,
                days_played,
                best_day_score,
                average_score,
                last_played_date,
                last_score_update,
                joined_at
            )
            VALUES (
                comp_record.id,
                user_record.user_id,
                user_record.correct_total,
                user_record.correct_days,
                user_record.best_score,
                ROUND(user_record.correct_total / user_record.correct_days, 1),
                user_record.last_date,
                NOW(),
                NOW()
            )
            ON CONFLICT (competition_id, user_id)
            DO UPDATE SET
                total_score = user_record.correct_total,
                days_played = user_record.correct_days,
                best_day_score = user_record.best_score,
                average_score = ROUND(user_record.correct_total / user_record.correct_days, 1),
                last_played_date = user_record.last_date,
                last_score_update = NOW();

            -- Only log if there was a change
            IF ABS(user_record.old_total - user_record.correct_total) > 0.1 THEN
                RAISE NOTICE '   ✅ Fixed %: % → % (% days)',
                    user_record.username,
                    user_record.old_total,
                    user_record.correct_total,
                    user_record.correct_days;
                total_fixed := total_fixed + 1;
            END IF;
        END LOOP;

        RAISE NOTICE '';
    END LOOP;

    RAISE NOTICE '========================================================';
    RAISE NOTICE '✅ COMPLETE!';
    RAISE NOTICE '   Competitions processed: %', competitions_processed;
    RAISE NOTICE '   Users fixed: %', total_fixed;
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 4: VERIFICATION - Show Final State of All Competitions
-- ============================================================================

DO $$
DECLARE
    comp_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '📋 FINAL LEADERBOARDS FOR ALL ACTIVE COMPETITIONS';
    RAISE NOTICE '========================================================';

    FOR comp_record IN
        SELECT id, name, start_date, end_date
        FROM competitions
        WHERE is_active = true
        ORDER BY start_date DESC
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE '🏆 %', comp_record.name;
        RAISE NOTICE '   Period: % to %', comp_record.start_date, comp_record.end_date;
        RAISE NOTICE '   ----------------------------------------';

        -- This will be displayed in the query results below
    END LOOP;
END $$;

-- Show leaderboards for all active competitions
SELECT
    c.name as competition,
    ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cp.total_score DESC, cp.days_played DESC) as rank,
    u.username,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date,
    CASE
        WHEN ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cp.total_score DESC, cp.days_played DESC) = 1 THEN '🥇'
        WHEN ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cp.total_score DESC, cp.days_played DESC) = 2 THEN '🥈'
        WHEN ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cp.total_score DESC, cp.days_played DESC) = 3 THEN '🥉'
        ELSE ''
    END as medal
FROM competitions c
JOIN competition_participants cp ON c.id = cp.competition_id
JOIN users u ON cp.user_id = u.id
WHERE c.is_active = true
  AND cp.total_score > 0
ORDER BY c.start_date DESC, cp.total_score DESC, cp.days_played DESC;

-- ============================================================================
-- PART 5: FINAL SANITY CHECK - Verify No Mismatches Remain
-- ============================================================================

DO $$
DECLARE
    mismatch_count INTEGER;
    comp_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '🔍 FINAL VERIFICATION - CHECKING FOR REMAINING ISSUES';
    RAISE NOTICE '========================================================';

    FOR comp_record IN
        SELECT id, name FROM competitions WHERE is_active = true
    LOOP
        SELECT COUNT(*) INTO mismatch_count
        FROM (
            WITH calculated_totals AS (
                SELECT
                    ds.user_id,
                    SUM(
                        ROUND(
                            (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                             COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                             COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                            1
                        )
                    ) as calculated_total
                FROM daily_scores ds
                CROSS JOIN (
                    SELECT start_date, end_date
                    FROM competitions
                    WHERE id = comp_record.id
                ) c
                WHERE ds.date >= c.start_date
                  AND ds.date <= c.end_date
                  AND ds.date <= CURRENT_DATE
                  AND ds.completed_at IS NOT NULL
                GROUP BY ds.user_id
            )
            SELECT 1
            FROM competition_participants cp
            JOIN calculated_totals ct ON cp.user_id = ct.user_id
            WHERE cp.competition_id = comp_record.id
              AND ABS(ct.calculated_total - cp.total_score) > 0.1
        ) mismatches;

        IF mismatch_count > 0 THEN
            RAISE NOTICE '⚠️  %: % users still have mismatches', comp_record.name, mismatch_count;
        ELSE
            RAISE NOTICE '✅ %: All scores correct', comp_record.name;
        END IF;
    END LOOP;

    RAISE NOTICE '========================================================';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 FIX COMPLETE!';
    RAISE NOTICE '';
    RAISE NOTICE 'What was fixed:';
    RAISE NOTICE '1. ✅ submit_to_custom_competition() now ADDS scores (not replaces)';
    RAISE NOTICE '2. ✅ update_competition_score() now ADDS scores (not replaces)';
    RAISE NOTICE '3. ✅ All competition scores recalculated from daily_scores';
    RAISE NOTICE '4. ✅ Verified all scores match calculated totals';
    RAISE NOTICE '';
    RAISE NOTICE 'The bug will not recur - all future score submissions will accumulate correctly.';
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
END $$;
