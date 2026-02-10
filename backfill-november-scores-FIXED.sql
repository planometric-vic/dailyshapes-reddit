-- Backfill November 2025 scores into NOVEMBER GLOBAL competition
-- Run this AFTER running fix-duplicate-function.sql

-- Get the competition ID
DO $$
DECLARE
    competition_uuid UUID;
    score_record RECORD;
    total_backfilled INTEGER := 0;
BEGIN
    -- Find the NOVEMBER GLOBAL competition
    SELECT id INTO competition_uuid
    FROM competitions
    WHERE name = 'NOVEMBER GLOBAL'
      AND start_date = '2025-11-01'
    LIMIT 1;

    IF competition_uuid IS NULL THEN
        RAISE EXCEPTION 'NOVEMBER GLOBAL competition not found!';
    END IF;

    RAISE NOTICE '📅 Found NOVEMBER GLOBAL competition: %', competition_uuid;

    -- Loop through all November 2025 daily scores
    FOR score_record IN
        SELECT
            user_id,
            date,
            daily_average::NUMERIC as daily_avg,
            shape1_attempt1,
            shape1_attempt2,
            shape2_attempt1,
            shape2_attempt2,
            shape3_attempt1,
            shape3_attempt2
        FROM daily_scores
        WHERE date >= '2025-11-01'
          AND date <= '2025-11-30'
          AND daily_average > 0
        ORDER BY date, user_id
    LOOP
        -- Call the update function with explicit type casting
        PERFORM update_competition_score(
            competition_uuid::UUID,
            score_record.user_id::UUID,
            score_record.daily_avg::NUMERIC
        );

        total_backfilled := total_backfilled + 1;

        -- Progress indicator every 10 records
        IF total_backfilled % 10 = 0 THEN
            RAISE NOTICE '   Processed % scores...', total_backfilled;
        END IF;
    END LOOP;

    RAISE NOTICE '✅ Backfill complete! Total scores added: %', total_backfilled;
END $$;

-- Verify the results
SELECT
    u.username,
    cp.total_score,
    cp.days_played,
    cp.average_score,
    cp.rank
FROM competition_participants cp
JOIN users u ON u.id = cp.user_id
WHERE cp.competition_id = (
    SELECT id FROM competitions WHERE name = 'NOVEMBER GLOBAL' LIMIT 1
)
ORDER BY cp.total_score DESC
LIMIT 20;

-- Show summary statistics
SELECT
    'BACKFILL SUMMARY' as status,
    COUNT(*) as total_participants,
    SUM(days_played) as total_days_recorded,
    ROUND(AVG(total_score), 1) as avg_total_score,
    MAX(total_score) as highest_score,
    MIN(total_score) as lowest_score
FROM competition_participants
WHERE competition_id = (
    SELECT id FROM competitions WHERE name = 'NOVEMBER GLOBAL' LIMIT 1
);
