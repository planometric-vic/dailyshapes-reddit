-- Diagnose why there's no connection between daily_scores and competitions

-- 1. Check if daily_scores exist at all for these users
SELECT 
    '=== ALL DAILY SCORES FOR THESE USERS ===' as section;

SELECT 
    u.username,
    COUNT(*) as total_daily_scores,
    MIN(ds.date) as earliest_date,
    MAX(ds.date) as latest_date,
    array_agg(DISTINCT ds.date ORDER BY ds.date) as all_dates
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
WHERE u.username IN ('planman', 'benk88', 'Oakyboy')
GROUP BY u.username
ORDER BY u.username;

-- 2. Check the competitions_participated arrays
SELECT 
    '=== COMPETITIONS_PARTICIPATED ARRAYS ===' as section;

SELECT 
    u.username,
    ds.date,
    ds.competitions_participated,
    array_length(ds.competitions_participated, 1) as array_length,
    CASE 
        WHEN ds.competitions_participated IS NULL THEN 'NULL'
        WHEN array_length(ds.competitions_participated, 1) IS NULL THEN 'EMPTY ARRAY'
        ELSE 'HAS DATA'
    END as array_status
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
WHERE u.username IN ('planman', 'benk88', 'Oakyboy')
ORDER BY u.username, ds.date DESC
LIMIT 20;

-- 3. Check active competition IDs
SELECT 
    '=== ACTIVE COMPETITION IDS ===' as section;

SELECT 
    c.id,
    c.name,
    c.start_date,
    c.end_date,
    c.is_active,
    COUNT(cp.user_id) as participant_count
FROM competitions c
LEFT JOIN competition_participants cp ON c.id = cp.competition_id
WHERE c.is_active = true
GROUP BY c.id, c.name, c.start_date, c.end_date, c.is_active
ORDER BY c.name;

-- 4. Manually fix the competitions_participated arrays if they're empty
-- This will link the daily_scores to the competitions where the users are participants

-- First, show what needs to be fixed
SELECT 
    '=== WHAT NEEDS TO BE FIXED ===' as section;

SELECT 
    u.username,
    ds.date,
    'Currently: ' || COALESCE(ds.competitions_participated::text, 'NULL') as current_competitions,
    'Should be: ' || array_agg(DISTINCT cp.competition_id)::text as should_be_competitions
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
JOIN competition_participants cp ON cp.user_id = u.id
JOIN competitions c ON c.id = cp.competition_id
WHERE u.username IN ('planman', 'benk88', 'Oakyboy')
    AND ds.date >= c.start_date
    AND ds.date <= c.end_date
GROUP BY u.username, ds.date, ds.competitions_participated
ORDER BY u.username, ds.date;

-- 5. Apply the fix
BEGIN;

UPDATE daily_scores ds
SET competitions_participated = (
    SELECT array_agg(DISTINCT cp.competition_id)
    FROM competition_participants cp
    JOIN competitions c ON c.id = cp.competition_id
    WHERE cp.user_id = ds.user_id
        AND ds.date >= c.start_date
        AND ds.date <= c.end_date
        AND c.is_active = true
)
FROM users u
WHERE ds.user_id = u.id
    AND u.username IN ('planman', 'benk88', 'Oakyboy')
    AND (ds.competitions_participated IS NULL 
         OR array_length(ds.competitions_participated, 1) IS NULL);

COMMIT;

-- 6. Verify the fix
SELECT 
    '=== AFTER FIX - COMPETITIONS_PARTICIPATED ===' as section;

SELECT 
    u.username,
    ds.date,
    ds.competitions_participated,
    array_length(ds.competitions_participated, 1) as array_length
FROM daily_scores ds
JOIN users u ON ds.user_id = u.id
WHERE u.username IN ('planman', 'benk88', 'Oakyboy')
ORDER BY u.username, ds.date DESC;

-- 7. Now recalculate competition scores correctly
UPDATE competition_participants cp
SET 
    total_score = COALESCE((
        SELECT 
            ROUND(AVG(
                (GREATEST(ds.shape1_attempt1, COALESCE(ds.shape1_attempt2, 0)) + 
                 GREATEST(ds.shape2_attempt1, COALESCE(ds.shape2_attempt2, 0)) + 
                 GREATEST(ds.shape3_attempt1, COALESCE(ds.shape3_attempt2, 0))) / 3.0
            ), 1)
        FROM daily_scores ds
        JOIN competitions c ON c.id = cp.competition_id
        WHERE ds.user_id = cp.user_id
            AND ds.date >= c.start_date
            AND ds.date <= c.end_date
            AND c.id = ANY(ds.competitions_participated)
    ), 0),
    days_played = COALESCE((
        SELECT COUNT(DISTINCT ds.date)
        FROM daily_scores ds
        JOIN competitions c ON c.id = cp.competition_id
        WHERE ds.user_id = cp.user_id
            AND ds.date >= c.start_date
            AND ds.date <= c.end_date
            AND c.id = ANY(ds.competitions_participated)
    ), 0)
FROM users u
WHERE cp.user_id = u.id
    AND u.username IN ('planman', 'benk88', 'Oakyboy');

-- Update average_score to match total_score (since we now have correct values)
UPDATE competition_participants cp
SET 
    average_score = cp.total_score,
    best_day_score = cp.total_score
FROM users u
WHERE cp.user_id = u.id
    AND u.username IN ('planman', 'benk88', 'Oakyboy')
    AND cp.days_played = 1;

-- 8. Show final results
SELECT 
    '=== FINAL CORRECTED RESULTS ===' as section;

SELECT 
    u.username,
    cp.days_played,
    ROUND(cp.total_score, 1) as score,
    c.name as competition
FROM competition_participants cp
JOIN users u ON cp.user_id = u.id
JOIN competitions c ON cp.competition_id = c.id
WHERE u.username IN ('planman', 'benk88', 'Oakyboy')
ORDER BY c.name, cp.total_score DESC;