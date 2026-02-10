-- Emergency fix for "Our Times" competition
-- Include Oct 14 scores that were excluded

-- Competition: 6b68e958-f2ec-4bfd-842d-dd5169446fbe
-- Issue: Oct 14 scores not counted (competition may have wrong end date)

-- ============================================================================
-- STEP 1: Update competition end_date if needed
-- ============================================================================
-- First check current end date
SELECT
    'Current competition dates' as info,
    name,
    start_date,
    end_date,
    CURRENT_DATE as today
FROM competitions
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;

-- If end_date is before Oct 14, update it
-- (Only run this if the competition should include Oct 14)
UPDATE competitions
SET end_date = '2025-10-19'  -- Extend to Oct 19 (original 8 days from Oct 12)
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
  AND end_date < '2025-10-14';  -- Only update if currently before Oct 14

-- Confirm the update
SELECT
    'Updated competition dates' as info,
    name,
    start_date,
    end_date
FROM competitions
WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid;

-- ============================================================================
-- STEP 2: Recalculate ALL scores for this competition with Oct 14 included
-- ============================================================================
DO $$
DECLARE
    user_record RECORD;
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 Recalculating scores for Our Times competition...';
    RAISE NOTICE '';

    -- For each user in the competition
    FOR user_record IN
        WITH comp_info AS (
            SELECT start_date, end_date
            FROM competitions
            WHERE id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
        ),
        calculated_scores AS (
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
                MAX(ds.date) as last_date
            FROM daily_scores ds
            CROSS JOIN comp_info ci
            WHERE ds.date >= ci.start_date
              AND ds.date <= ci.end_date
              AND ds.date <= CURRENT_DATE
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
            cs.correct_total,
            cs.correct_days,
            cs.best_score,
            cs.last_date
        FROM calculated_scores cs
        LEFT JOIN competition_participants cp
            ON cp.user_id = cs.user_id
            AND cp.competition_id = '6b68e958-f2ec-4bfd-842d-dd5169446fbe'::uuid
        LEFT JOIN users u ON u.id = cs.user_id
        WHERE cs.correct_total > 0
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

        -- Log if there was a change
        IF ABS(user_record.old_total - user_record.correct_total) > 0.1 THEN
            RAISE NOTICE '✅ Fixed %: % → % (% days)',
                user_record.username,
                user_record.old_total,
                user_record.correct_total,
                user_record.correct_days;
            fixed_count := fixed_count + 1;
        END IF;
    END LOOP;

    RAISE NOTICE '';
    RAISE NOTICE '✅ Fixed % users in Our Times competition', fixed_count;
END $$;

-- ============================================================================
-- STEP 3: Show updated leaderboard
-- ============================================================================
SELECT
    'Updated Our Times Leaderboard' as section,
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
