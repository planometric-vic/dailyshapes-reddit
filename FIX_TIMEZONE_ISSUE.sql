-- ============================================================================
-- FIX FOR TIMEZONE ISSUE
-- ============================================================================
-- Problem: Server CURRENT_DATE is 2025-10-13 but users have played 2025-10-14
-- Solution: Don't use CURRENT_DATE, explicitly allow all dates up to competition end
-- ============================================================================

-- ============================================================================
-- PART 1: Fix the functions to NOT filter by CURRENT_DATE
-- ============================================================================

DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC);
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, NUMERIC, DATE);
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, DECIMAL(4,1));
DROP FUNCTION IF EXISTS submit_to_custom_competition(UUID, UUID, DECIMAL(4,1), DATE);

-- Fixed function - no CURRENT_DATE filtering
CREATE OR REPLACE FUNCTION submit_to_custom_competition(
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
        last_played_date = GREATEST(competition_participants.last_played_date, p_date),
        last_score_update = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION submit_to_custom_competition(UUID, UUID, NUMERIC, DATE) TO authenticated;

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
        last_played_date = GREATEST(competition_participants.last_played_date, p_date),
        last_score_update = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_competition_score(UUID, UUID, NUMERIC, DATE) TO authenticated;

DO $$ BEGIN
    RAISE NOTICE '✅ Functions fixed - no longer filter by CURRENT_DATE';
END $$;

-- ============================================================================
-- PART 2: Recalculate ALL competitions WITHOUT CURRENT_DATE filter
-- ============================================================================

DO $$
DECLARE
    comp_record RECORD;
    user_record RECORD;
    total_fixed INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '🔧 RECALCULATING ALL COMPETITIONS (TIMEZONE FIX)';
    RAISE NOTICE '========================================================';
    RAISE NOTICE '';

    FOR comp_record IN
        SELECT id, name, start_date, end_date
        FROM competitions
        WHERE is_active = true
        ORDER BY start_date DESC
    LOOP
        RAISE NOTICE '📊 %', comp_record.name;
        RAISE NOTICE '   Dates: % to %', comp_record.start_date, comp_record.end_date;

        FOR user_record IN
            SELECT
                u.username,
                ds.user_id,
                COALESCE(cp.total_score, 0) as old_total,
                COALESCE(cp.days_played, 0) as old_days,
                SUM(
                    ROUND(
                        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                        1
                    )
                ) as correct_total,
                COUNT(*) as correct_days,
                MAX(
                    ROUND(
                        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                        1
                    )
                ) as best_score,
                MAX(ds.date) as last_date,
                string_agg(
                    ds.date::text || '=' ||
                    ROUND(
                        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                        1
                    )::text,
                    ', '
                    ORDER BY ds.date
                ) as dates_breakdown
            FROM daily_scores ds
            LEFT JOIN competition_participants cp
                ON cp.user_id = ds.user_id
                AND cp.competition_id = comp_record.id
            LEFT JOIN users u ON u.id = ds.user_id
            WHERE ds.user_id IN (
                SELECT user_id
                FROM competition_participants
                WHERE competition_id = comp_record.id
            )
            AND ds.date >= comp_record.start_date
            AND ds.date <= comp_record.end_date
            -- CRITICAL: Removed CURRENT_DATE filter to include Oct 14
            AND ds.completed_at IS NOT NULL
            GROUP BY u.username, ds.user_id, cp.total_score, cp.days_played
            HAVING SUM(
                ROUND(
                    (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                     COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                     COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                    1
                )
            ) > 0
            ORDER BY correct_total DESC
        LOOP
            UPDATE competition_participants
            SET
                total_score = user_record.correct_total,
                days_played = user_record.correct_days,
                best_day_score = user_record.best_score,
                average_score = ROUND(user_record.correct_total / user_record.correct_days, 1),
                last_played_date = user_record.last_date,
                last_score_update = NOW()
            WHERE competition_id = comp_record.id
              AND user_id = user_record.user_id;

            IF ABS(user_record.old_total - user_record.correct_total) > 0.1 THEN
                RAISE NOTICE '   ✅ %: % → % (% days)',
                    user_record.username,
                    user_record.old_total,
                    user_record.correct_total,
                    user_record.correct_days;
                RAISE NOTICE '      Dates: %', user_record.dates_breakdown;
                total_fixed := total_fixed + 1;
            END IF;
        END LOOP;

        RAISE NOTICE '';
    END LOOP;

    RAISE NOTICE '========================================================';
    RAISE NOTICE '✅ COMPLETE - Fixed % users', total_fixed;
    RAISE NOTICE '========================================================';
END $$;

-- ============================================================================
-- Show final leaderboards
-- ============================================================================
SELECT
    '🏆 UPDATED LEADERBOARDS' as section,
    c.name as competition,
    ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cp.total_score DESC) as rank,
    u.username,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.last_played_date,
    CASE
        WHEN ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cp.total_score DESC) = 1 THEN '🥇'
        WHEN ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cp.total_score DESC) = 2 THEN '🥈'
        WHEN ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY cp.total_score DESC) = 3 THEN '🥉'
        ELSE ''
    END as medal
FROM competitions c
JOIN competition_participants cp ON c.id = cp.competition_id
JOIN users u ON cp.user_id = u.id
WHERE c.is_active = true
  AND cp.total_score > 0
ORDER BY c.start_date DESC, c.name, cp.total_score DESC;
