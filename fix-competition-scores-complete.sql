-- ============================================================================
-- COMPLETE FIX FOR COMPETITION SCORE BUG
-- Competition: 6b68e958-f2ec-4bfd-842d-dd5169446fbe
-- Issue: Scores being REPLACED instead of ACCUMULATED
-- ============================================================================

-- ============================================================================
-- PART 1: FIX THE DATABASE FUNCTION
-- ============================================================================

-- Drop the buggy function (both possible signatures)
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC, DATE);
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, DECIMAL(4,1));

-- Create the corrected function using INSERT ... ON CONFLICT (most atomic)
CREATE OR REPLACE FUNCTION submit_to_custom_competition(
    p_competition_id UUID,
    p_user_id UUID,
    p_daily_score NUMERIC,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS void AS $$
BEGIN
    -- Use INSERT ... ON CONFLICT for atomic upsert
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
        total_score = competition_participants.total_score + p_daily_score,  -- ADD, not replace!
        days_played = competition_participants.days_played + 1,
        best_day_score = GREATEST(competition_participants.best_day_score, p_daily_score),
        average_score = ROUND((competition_participants.total_score + p_daily_score) / (competition_participants.days_played + 1), 1),
        last_played_date = p_date,
        last_score_update = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION submit_to_custom_competition(UUID, UUID, NUMERIC, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_to_custom_competition(UUID, UUID, NUMERIC) TO authenticated;

RAISE NOTICE '✅ Function submit_to_custom_competition has been fixed';

-- ============================================================================
-- PART 2: ANALYZE ALL USERS IN COMPETITION FOR MISMATCHES
-- ============================================================================

DO $$
DECLARE
    mismatch_record RECORD;
    mismatch_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 CHECKING ALL USERS FOR SCORE MISMATCHES...';
    RAISE NOTICE '=================================================';

    FOR mismatch_record IN
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
                ) as calculated_total,
                COUNT(*) as calculated_days,
                MIN(ds.date) as first_date,
                MAX(ds.date) as last_date
            FROM daily_scores ds
            CROSS JOIN (
                SELECT start_date, end_date
                FROM competitions
                WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
            ) c
            WHERE ds.date >= c.start_date
              AND ds.date <= c.end_date
              AND ds.completed_at IS NOT NULL
            GROUP BY ds.user_id
        )
        SELECT
            u.username,
            cp.user_id,
            cp.total_score as stored_total,
            ct.calculated_total,
            (ct.calculated_total - cp.total_score) as difference,
            cp.days_played as stored_days,
            ct.calculated_days,
            ct.first_date,
            ct.last_date
        FROM competition_participants cp
        JOIN calculated_totals ct ON cp.user_id = ct.user_id
        JOIN users u ON cp.user_id = u.id
        WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
          AND ABS(ct.calculated_total - cp.total_score) > 0.1  -- Only mismatches
        ORDER BY difference DESC
    LOOP
        mismatch_count := mismatch_count + 1;

        RAISE NOTICE '';
        RAISE NOTICE '❌ MISMATCH #%: %', mismatch_count, mismatch_record.username;
        RAISE NOTICE '   User ID: %', mismatch_record.user_id;
        RAISE NOTICE '   Stored Total: % | Correct Total: %', mismatch_record.stored_total, mismatch_record.calculated_total;
        RAISE NOTICE '   Stored Days: % | Actual Days: %', mismatch_record.stored_days, mismatch_record.calculated_days;
        RAISE NOTICE '   Missing Score: %', mismatch_record.difference;
        RAISE NOTICE '   Date Range: % to %', mismatch_record.first_date, mismatch_record.last_date;
    END LOOP;

    IF mismatch_count = 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ No mismatches found - all scores are correct!';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️ Found % users with incorrect scores', mismatch_count;
    END IF;

    RAISE NOTICE '=================================================';
END $$;

-- ============================================================================
-- PART 3: RECALCULATE ALL AFFECTED USERS' SCORES
-- ============================================================================

DO $$
DECLARE
    fixed_count INTEGER := 0;
    fix_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 FIXING ALL AFFECTED USERS...';
    RAISE NOTICE '=================================================';

    -- Recalculate scores for all affected users
    FOR fix_record IN
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
                ) as correct_total,
                COUNT(*) as correct_days,
                MAX(ds.date) as last_date
            FROM daily_scores ds
            CROSS JOIN (
                SELECT start_date, end_date
                FROM competitions
                WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
            ) c
            WHERE ds.date >= c.start_date
              AND ds.date <= c.end_date
              AND ds.completed_at IS NOT NULL
            GROUP BY ds.user_id
        )
        SELECT
            u.username,
            ct.user_id,
            cp.total_score as old_total,
            ct.correct_total,
            ct.correct_days,
            ct.last_date
        FROM calculated_totals ct
        JOIN competition_participants cp ON ct.user_id = cp.user_id
        JOIN users u ON ct.user_id = u.id
        WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
          AND ABS(ct.correct_total - cp.total_score) > 0.1  -- Only fix mismatches
    LOOP
        -- Update the participant record with correct values
        UPDATE competition_participants
        SET
            total_score = fix_record.correct_total,
            days_played = fix_record.correct_days,
            average_score = ROUND(fix_record.correct_total / fix_record.correct_days, 1),
            last_played_date = fix_record.last_date,
            last_score_update = NOW()
        WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
          AND user_id = fix_record.user_id;

        fixed_count := fixed_count + 1;

        RAISE NOTICE '✅ Fixed %: % → % (% days)',
            fix_record.username,
            fix_record.old_total,
            fix_record.correct_total,
            fix_record.correct_days;
    END LOOP;

    RAISE NOTICE '';
    IF fixed_count > 0 THEN
        RAISE NOTICE '✅ Successfully fixed % users', fixed_count;
    ELSE
        RAISE NOTICE '✅ No users needed fixing';
    END IF;

    RAISE NOTICE '=================================================';
END $$;

-- ============================================================================
-- PART 4: VERIFY THE FIXES
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 FINAL VERIFICATION - ALL USERS:';
    RAISE NOTICE '=================================================';
END $$;

-- Show final state of all participants
SELECT
    ROW_NUMBER() OVER (ORDER BY cp.total_score DESC, cp.days_played DESC) as rank,
    u.username,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date,
    CASE
        WHEN ROW_NUMBER() OVER (ORDER BY cp.total_score DESC, cp.days_played DESC) = 1 THEN '🥇'
        WHEN ROW_NUMBER() OVER (ORDER BY cp.total_score DESC, cp.days_played DESC) = 2 THEN '🥈'
        WHEN ROW_NUMBER() OVER (ORDER BY cp.total_score DESC, cp.days_played DESC) = 3 THEN '🥉'
        ELSE ''
    END as medal
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND cp.total_score > 0
ORDER BY cp.total_score DESC, cp.days_played DESC;

-- ============================================================================
-- PART 5: FINAL SANITY CHECK - RE-CHECK FOR MISMATCHES
-- ============================================================================

DO $$
DECLARE
    remaining_mismatches INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_mismatches
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
                WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
            ) c
            WHERE ds.date >= c.start_date
              AND ds.date <= c.end_date
              AND ds.completed_at IS NOT NULL
            GROUP BY ds.user_id
        )
        SELECT 1
        FROM competition_participants cp
        JOIN calculated_totals ct ON cp.user_id = ct.user_id
        WHERE cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
          AND ABS(ct.calculated_total - cp.total_score) > 0.1
    ) mismatches;

    RAISE NOTICE '';
    RAISE NOTICE '=================================================';
    IF remaining_mismatches = 0 THEN
        RAISE NOTICE '✅✅✅ SUCCESS! All scores are now correct!';
    ELSE
        RAISE NOTICE '⚠️ WARNING: % users still have mismatched scores', remaining_mismatches;
        RAISE NOTICE '   You may need to run this script again or investigate further.';
    END IF;
    RAISE NOTICE '=================================================';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Competition score fix complete!';
    RAISE NOTICE '';
END $$;
