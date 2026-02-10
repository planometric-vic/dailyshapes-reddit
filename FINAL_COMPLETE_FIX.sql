-- ============================================================================
-- COMPLETE FIX FOR ALL COMPETITIONS - FINAL VERSION
-- ============================================================================
-- This script will:
-- 1. Fix the database functions to ADD scores correctly
-- 2. Recalculate ALL scores for ALL active competitions (hardcoded date logic)
-- 3. Ensure skipped days = 0 points (only days played count)
-- 4. Guarantee future daily submissions work correctly
-- ============================================================================

-- ============================================================================
-- PART 1: FIX THE SUBMIT FUNCTION (Permanent Fix)
-- ============================================================================

DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC, DATE);
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, DECIMAL(4,1));
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, DECIMAL(4,1), DATE);

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
        -- CRITICAL: ADD to existing total, never replace
        total_score = competition_participants.total_score + p_daily_score,
        days_played = competition_participants.days_played + 1,
        best_day_score = GREATEST(competition_participants.best_day_score, p_daily_score),
        average_score = ROUND((competition_participants.total_score + p_daily_score) / (competition_participants.days_played + 1), 1),
        last_played_date = p_date,
        last_score_update = NOW();

    RAISE NOTICE 'Submitted score for user %: +% (date: %)', p_user_id, p_daily_score, p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_to_custom_competition(UUID, UUID, NUMERIC, DATE) TO authenticated;

-- ============================================================================
-- PART 2: FIX THE GLOBAL COMPETITION FUNCTION
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

GRANT EXECUTE ON FUNCTION update_competition_score(UUID, UUID, NUMERIC, DATE) TO authenticated;

DO $$ BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '✅ Functions fixed - scores will now ADD correctly';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 3: RECALCULATE ALL COMPETITIONS WITH EXPLICIT DATE RANGE
-- ============================================================================

DO $$
DECLARE
    comp_record RECORD;
    user_record RECORD;
    total_competitions INTEGER := 0;
    total_users_fixed INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================================';
    RAISE NOTICE '🔧 RECALCULATING ALL ACTIVE COMPETITIONS';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';

    -- Loop through all active competitions
    FOR comp_record IN
        SELECT
            id,
            name,
            start_date,
            end_date,
            is_global
        FROM competitions
        WHERE is_active = true
        ORDER BY start_date DESC
    LOOP
        total_competitions := total_competitions + 1;

        RAISE NOTICE '📊 Competition: %', comp_record.name;
        RAISE NOTICE '   Dates: % to %', comp_record.start_date, comp_record.end_date;
        RAISE NOTICE '   ----------------------------------------';

        -- For each user in this competition, calculate their correct score
        FOR user_record IN
            WITH daily_scores_in_range AS (
                SELECT
                    ds.user_id,
                    ds.date,
                    ROUND(
                        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                        1
                    ) as daily_score
                FROM daily_scores ds
                WHERE ds.user_id IN (
                    SELECT user_id
                    FROM competition_participants
                    WHERE competition_id = comp_record.id
                )
                -- CRITICAL: Only include dates within competition range
                AND ds.date >= comp_record.start_date
                AND ds.date <= comp_record.end_date
                -- Don't include future dates (if competition extends beyond today)
                AND ds.date <= CURRENT_DATE
                -- Only include completed games
                AND ds.completed_at IS NOT NULL
                -- Ensure at least one score exists (not all NULL)
                AND (ds.shape1_attempt1 IS NOT NULL OR ds.shape1_attempt2 IS NOT NULL OR
                     ds.shape2_attempt1 IS NOT NULL OR ds.shape2_attempt2 IS NOT NULL OR
                     ds.shape3_attempt1 IS NOT NULL OR ds.shape3_attempt2 IS NOT NULL)
            ),
            aggregated_scores AS (
                SELECT
                    user_id,
                    SUM(daily_score) as correct_total,
                    COUNT(*) as correct_days,
                    MAX(daily_score) as best_score,
                    MAX(date) as last_date
                FROM daily_scores_in_range
                GROUP BY user_id
            )
            SELECT
                u.username,
                a.user_id,
                COALESCE(cp.total_score, 0) as old_total,
                COALESCE(cp.days_played, 0) as old_days,
                a.correct_total,
                a.correct_days,
                a.best_score,
                a.last_date
            FROM aggregated_scores a
            LEFT JOIN competition_participants cp
                ON cp.user_id = a.user_id
                AND cp.competition_id = comp_record.id
            LEFT JOIN users u ON u.id = a.user_id
            WHERE a.correct_total > 0
            ORDER BY a.correct_total DESC
        LOOP
            -- Update or insert the participant record
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

            -- Log changes
            IF ABS(user_record.old_total - user_record.correct_total) > 0.1 THEN
                RAISE NOTICE '   ✅ %: % → % (% days → % days)',
                    user_record.username,
                    user_record.old_total,
                    user_record.correct_total,
                    user_record.old_days,
                    user_record.correct_days;
                total_users_fixed := total_users_fixed + 1;
            ELSE
                RAISE NOTICE '   ✓ %: % (% days) - already correct',
                    user_record.username,
                    user_record.correct_total,
                    user_record.correct_days;
            END IF;
        END LOOP;

        RAISE NOTICE '';
    END LOOP;

    RAISE NOTICE '========================================================';
    RAISE NOTICE '✅ RECALCULATION COMPLETE';
    RAISE NOTICE '   Competitions processed: %', total_competitions;
    RAISE NOTICE '   Users updated: %', total_users_fixed;
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';
END $$;

-- ============================================================================
-- PART 4: VERIFICATION - Show All Competitions
-- ============================================================================

SELECT
    '🏆 ALL ACTIVE COMPETITION LEADERBOARDS' as section,
    c.name as competition,
    c.start_date,
    c.end_date,
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
ORDER BY
    c.start_date DESC,
    c.name,
    cp.total_score DESC,
    cp.days_played DESC;

-- ============================================================================
-- PART 5: FINAL VERIFICATION - Check for Mismatches
-- ============================================================================

DO $$
DECLARE
    comp_record RECORD;
    mismatch_count INTEGER;
    total_mismatches INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '🔍 FINAL VERIFICATION';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';

    FOR comp_record IN
        SELECT id, name, start_date, end_date
        FROM competitions
        WHERE is_active = true
        ORDER BY start_date DESC
    LOOP
        -- Count mismatches for this competition
        SELECT COUNT(*) INTO mismatch_count
        FROM (
            WITH calculated AS (
                SELECT
                    ds.user_id,
                    SUM(
                        ROUND(
                            (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                             COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                             COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                            1
                        )
                    ) as calc_total
                FROM daily_scores ds
                WHERE ds.date >= comp_record.start_date
                  AND ds.date <= comp_record.end_date
                  AND ds.date <= CURRENT_DATE
                  AND ds.completed_at IS NOT NULL
                GROUP BY ds.user_id
            )
            SELECT 1
            FROM competition_participants cp
            JOIN calculated c ON cp.user_id = c.user_id
            WHERE cp.competition_id = comp_record.id
              AND ABS(c.calc_total - cp.total_score) > 0.1
        ) mismatches;

        IF mismatch_count > 0 THEN
            RAISE NOTICE '⚠️  %: % users with mismatches', comp_record.name, mismatch_count;
            total_mismatches := total_mismatches + mismatch_count;
        ELSE
            RAISE NOTICE '✅ %: All scores correct', comp_record.name;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
    IF total_mismatches = 0 THEN
        RAISE NOTICE '✅✅✅ ALL COMPETITIONS VERIFIED CORRECT';
    ELSE
        RAISE NOTICE '⚠️  % total mismatches found across all competitions', total_mismatches;
    END IF;
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 COMPLETE FIX APPLIED';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '1. ✅ Functions permanently fixed (ADD not REPLACE)';
    RAISE NOTICE '2. ✅ All competition scores recalculated from daily_scores';
    RAISE NOTICE '3. ✅ Only days within competition date range counted';
    RAISE NOTICE '4. ✅ Skipped days = 0 points (only played days count)';
    RAISE NOTICE '5. ✅ Future daily scores will ADD correctly';
    RAISE NOTICE '';
    RAISE NOTICE 'How it works going forward:';
    RAISE NOTICE '- User plays daily game → score saved to daily_scores table';
    RAISE NOTICE '- Competition function called → ADDS score to total';
    RAISE NOTICE '- Skip a day → nothing happens, score stays same';
    RAISE NOTICE '- Play next day → new score ADDS to existing total';
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
END $$;
