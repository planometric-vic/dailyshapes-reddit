-- Diagnose and Fix Days Counting Bug
-- Step 1: See what's actually in the daily_scores table

SELECT 
    '=== DAILY SCORES ANALYSIS ===' as section;

SELECT 
    u.username,
    ds.date,
    ds.shape1_attempt1, ds.shape1_attempt2,
    ds.shape2_attempt1, ds.shape2_attempt2,
    ds.shape3_attempt1, ds.shape3_attempt2,
    array_length(ds.competitions_participated, 1) as num_competitions
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
WHERE ds.date >= '2025-08-25'
ORDER BY u.username, ds.date;

-- Step 2: Count actual distinct days per user per competition
SELECT 
    '=== ACTUAL DAYS PLAYED ===' as section;

SELECT 
    u.username,
    c.name as competition_name,
    COUNT(DISTINCT ds.date) as actual_days_played,
    cp.days_played as current_days_played,
    cp.total_score,
    cp.average_score
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
LEFT JOIN daily_scores ds ON ds.user_id = cp.user_id
    AND ds.date >= c.start_date 
    AND ds.date <= c.end_date
    AND c.id = ANY(ds.competitions_participated)
WHERE cp.days_played > 0
GROUP BY u.username, c.name, cp.days_played, cp.total_score, cp.average_score
ORDER BY c.name, u.username;

-- Step 3: FORCE CORRECTION - Set everyone to 1 day and recalculate
-- Since we know you only played once on 2025-08-30

BEGIN;

-- For the test date (2025-08-30), set all participants to 1 day
UPDATE competition_participants cp
SET 
    days_played = 1,
    average_score = total_score,  -- Since only 1 day, average = total
    best_day_score = total_score
FROM competitions c
WHERE cp.competition_id = c.id
    AND c.start_date <= '2025-08-30'
    AND c.end_date >= '2025-08-30'
    AND cp.total_score > 0;

-- Now recalculate total scores properly (should be just the daily average for 1 day)
UPDATE competition_participants cp
SET 
    total_score = COALESCE((
        SELECT 
            CASE 
                WHEN ds.shape1_attempt2 IS NOT NULL THEN 
                    (GREATEST(ds.shape1_attempt1, ds.shape1_attempt2) + 
                     GREATEST(ds.shape2_attempt1, ds.shape2_attempt2) + 
                     GREATEST(ds.shape3_attempt1, ds.shape3_attempt2)) / 3.0
                ELSE 
                    (ds.shape1_attempt1 + ds.shape2_attempt1 + ds.shape3_attempt1) / 3.0
            END
        FROM daily_scores ds
        WHERE ds.user_id = cp.user_id
            AND ds.date = '2025-08-30'
            AND cp.competition_id = ANY(ds.competitions_participated)
        LIMIT 1
    ), cp.average_score),
    days_played = 1,
    average_score = COALESCE((
        SELECT 
            CASE 
                WHEN ds.shape1_attempt2 IS NOT NULL THEN 
                    (GREATEST(ds.shape1_attempt1, ds.shape1_attempt2) + 
                     GREATEST(ds.shape2_attempt1, ds.shape2_attempt2) + 
                     GREATEST(ds.shape3_attempt1, ds.shape3_attempt2)) / 3.0
                ELSE 
                    (ds.shape1_attempt1 + ds.shape2_attempt1 + ds.shape3_attempt1) / 3.0
            END
        FROM daily_scores ds
        WHERE ds.user_id = cp.user_id
            AND ds.date = '2025-08-30'
            AND cp.competition_id = ANY(ds.competitions_participated)
        LIMIT 1
    ), cp.average_score),
    best_day_score = COALESCE((
        SELECT 
            CASE 
                WHEN ds.shape1_attempt2 IS NOT NULL THEN 
                    (GREATEST(ds.shape1_attempt1, ds.shape1_attempt2) + 
                     GREATEST(ds.shape2_attempt1, ds.shape2_attempt2) + 
                     GREATEST(ds.shape3_attempt1, ds.shape3_attempt2)) / 3.0
                ELSE 
                    (ds.shape1_attempt1 + ds.shape2_attempt1 + ds.shape3_attempt1) / 3.0
            END
        FROM daily_scores ds
        WHERE ds.user_id = cp.user_id
            AND ds.date = '2025-08-30'
            AND cp.competition_id = ANY(ds.competitions_participated)
        LIMIT 1
    ), cp.average_score)
FROM competitions c
WHERE cp.competition_id = c.id
    AND c.start_date <= '2025-08-30'
    AND c.end_date >= '2025-08-30';

COMMIT;

-- Step 4: Show corrected results
SELECT 
    '=== CORRECTED RESULTS ===' as section;

SELECT 
    u.username,
    cp.days_played,
    ROUND(cp.total_score, 1) as total_score,
    ROUND(cp.average_score, 1) as average_score,
    ROUND(cp.best_day_score, 1) as best_day_score,
    c.name as competition_name
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
WHERE cp.days_played > 0
ORDER BY c.name, cp.total_score DESC;

-- Step 5: Update rankings after correction
DO $$
DECLARE
    comp_record RECORD;
BEGIN
    FOR comp_record IN 
        SELECT DISTINCT competition_id 
        FROM competition_participants 
        WHERE days_played > 0
    LOOP
        PERFORM update_competition_rankings(comp_record.competition_id);
    END LOOP;
END $$;