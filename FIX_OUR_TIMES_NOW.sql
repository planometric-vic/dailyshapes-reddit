-- Emergency fix for "Our Times" competition (6b68e958-f2ec-4bfd-842d-dd5169446fbe)
-- Competition runs: Oct 12-19, 2025
-- Issue: Missing Oct 14 scores for users

-- ============================================================================
-- Recalculate ALL participants with Oct 14 included
-- ============================================================================
DO $$
DECLARE
    user_record RECORD;
BEGIN
    RAISE NOTICE '🔧 Fixing Our Times competition scores...';
    RAISE NOTICE 'Competition: Oct 12-19, 2025';
    RAISE NOTICE '';

    FOR user_record IN
        WITH calculated_scores AS (
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
                MAX(
                    ROUND(
                        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                        1
                    )
                ) as best_score,
                MAX(ds.date) as last_date,
                string_agg(ds.date::text || ' (' ||
                    ROUND(
                        (COALESCE(ds.shape1_attempt1, 0) + COALESCE(ds.shape1_attempt2, 0) +
                         COALESCE(ds.shape2_attempt1, 0) + COALESCE(ds.shape2_attempt2, 0) +
                         COALESCE(ds.shape3_attempt1, 0) + COALESCE(ds.shape3_attempt2, 0)) / 6.0,
                        1
                    )::text || ')', ', ' ORDER BY ds.date) as dates_breakdown
            FROM daily_scores ds
            WHERE ds.date >= '2025-10-12'::date
              AND ds.date <= '2025-10-19'::date
              AND ds.date <= '2025-10-14'::date  -- Today
              AND ds.completed_at IS NOT NULL
              AND ds.user_id IN (
                  SELECT user_id
                  FROM competition_participants
                  WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
              )
            GROUP BY ds.user_id
        )
        SELECT
            u.username,
            cs.user_id,
            COALESCE(cp.total_score, 0) as old_total,
            COALESCE(cp.days_played, 0) as old_days,
            cs.correct_total,
            cs.correct_days,
            cs.best_score,
            cs.last_date,
            cs.dates_breakdown
        FROM calculated_scores cs
        LEFT JOIN competition_participants cp
            ON cp.user_id = cs.user_id
            AND cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
        LEFT JOIN users u ON u.id = cs.user_id
        WHERE cs.correct_total > 0
        ORDER BY cs.correct_total DESC
    LOOP
        -- Update the participant record
        UPDATE competition_participants
        SET
            total_score = user_record.correct_total,
            days_played = user_record.correct_days,
            best_day_score = user_record.best_score,
            average_score = ROUND(user_record.correct_total / user_record.correct_days, 1),
            last_played_date = user_record.last_date,
            last_score_update = NOW()
        WHERE competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
          AND user_id = user_record.user_id;

        RAISE NOTICE '✅ %: % → % (% days → % days)',
            user_record.username,
            user_record.old_total,
            user_record.correct_total,
            user_record.old_days,
            user_record.correct_days;
        RAISE NOTICE '   Dates: %', user_record.dates_breakdown;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Our Times competition fixed!';
END $$;

-- ============================================================================
-- Show updated leaderboard
-- ============================================================================
SELECT
    'UPDATED OUR TIMES LEADERBOARD' as section,
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
